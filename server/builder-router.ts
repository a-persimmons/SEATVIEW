import { generateObject, generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import defaultSimulationJson from "@contracts/default-simulation.json";
import { simulationSchema, toSimulationSummary, type Simulation } from "@contracts/simulation";
import { usableModelConfigSchema, type ModelConfig } from "@contracts/model-config";
import { adminQuery, createRouter } from "./middleware";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { persistSimulation } from "./simulation-router";

const defaultSimulation = simulationSchema.parse(defaultSimulationJson);

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SUPABASE_NOT_CONFIGURED",
    });
  }
  return getSupabase();
}

function provider(config: ModelConfig) {
  return createOpenAICompatible({
    name: "seatview-custom-model",
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    supportsStructuredOutputs: true,
  });
}

async function searchVenue(venueName: string, city: string, config: ModelConfig) {
  if (config.searchProvider === "none" || !config.searchApiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SEARCH_NOT_CONFIGURED",
    });
  }
  const endpoint = config.searchBaseUrl || "https://api.tavily.com/search";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.searchApiKey}`,
    },
    body: JSON.stringify({
      query: `${venueName} ${city} 体育场 建筑面积 坐席 高度 跑道 建筑参数`,
      max_results: 6,
      search_depth: "advanced",
      include_answer: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "公开资料搜索服务请求失败" });
  const result = await response.json() as {
    results?: { title: string; url: string; content?: string }[];
  };
  const sources = (result.results || []).slice(0, 6);
  if (!sources.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未搜索到可用的公开建筑资料，请改用已有场馆或补充资料" });
  }
  return sources;
}

const buildInput = z.object({
  title: z.string().trim().min(1).max(120),
  artist: z.string().trim().min(1).max(120),
  venueName: z.string().trim().min(1).max(160),
  city: z.string().trim().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  existingVenueId: z.string().optional().default(""),
  modelConfig: usableModelConfigSchema,
  imageBase64: z.string().min(100).max(18_000_000),
  imageType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export const builderRouter = createRouter({
  testConfig: adminQuery.input(usableModelConfigSchema).mutation(async ({ input }) => {
    try {
      const result = await generateText({
        model: provider(input)(input.modelName),
        prompt: "Reply with OK only.",
        maxOutputTokens: 8,
      });
      return { ok: true, response: result.text.slice(0, 40) };
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "模型连接失败，请检查 Base URL、密钥和模型名称" });
    }
  }),

  venues: adminQuery.query(async () => {
    const builtIn = {
      id: defaultSimulation.venue.id,
      name: defaultSimulation.venue.name,
      city: defaultSimulation.venue.city,
      sourceCount: defaultSimulation.venue.sources.length,
      reusable: true,
    };
    if (!isSupabaseConfigured()) return [builtIn];
    const { data, error } = await getSupabase()
      .from("venues")
      .select("id,name,city,sources")
      .order("name");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    const rows = (data as { id: string; name: string; city: string; sources: unknown[] }[]).map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      sourceCount: row.sources?.length || 0,
      reusable: true,
    }));
    return [builtIn, ...rows.filter((row) => row.id !== builtIn.id)];
  }),

  listAll: adminQuery.query(async () => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await getSupabase()
      .from("simulations")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(40);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return (data as { data: Simulation }[]).map((row) => toSimulationSummary(simulationSchema.parse(row.data)));
  }),

  build: adminQuery.input(buildInput).mutation(async ({ input }) => {
    const supabase = requireSupabase();
    const config = input.modelConfig;
    const visionModel = config.visionModelName || config.modelName;
    const reusingDefault = input.existingVenueId === defaultSimulation.venue.id;
    let venue = reusingDefault ? defaultSimulation.venue : null;
    let research: { title: string; url: string; content?: string }[] = [];

    if (input.existingVenueId && !venue) {
      const { data, error } = await supabase.from("venues").select("*").eq("id", input.existingVenueId).maybeSingle();
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      if (data) {
        const row = data as {
          id: string; name: string; city: string; aliases: string[];
          public_facts: string[]; sources: { label: string; url: string }[];
          model: Simulation["venue"]["model"]; stand_tiers: Simulation["venue"]["standTiers"];
        };
        venue = {
          id: row.id, name: row.name, city: row.city, aliases: row.aliases || [],
          publicFacts: row.public_facts || [], sources: row.sources || [],
          model: row.model, standTiers: row.stand_tiers,
        };
      }
    }
    if (!venue) research = await searchVenue(input.venueName, input.city, config);

    const id = `sim_${crypto.randomUUID().replaceAll("-", "")}`;
    const slug = `event-${Date.now().toString(36)}`;
    const generated = await generateObject({
      model: provider(config)(visionModel),
      schema: simulationSchema,
      system: `你是演唱会场馆模拟器的数据建模器。根据用户给出的演出信息和一张主办方 2D 分区图，生成可直接渲染的完整 JSON。不得生成座椅逐点坐标，座椅由客户端规则生成。舞台位于负 Z 方向，所有分区坐标使用米。票档颜色必须彼此可区分，文字主题颜色保持高对比。公开建筑参数只能来自给定资料，不确定的尺度使用明确估算，不得编造官方排号。`,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `演出信息：${JSON.stringify({ title: input.title, artist: input.artist, venueName: input.venueName, city: input.city, date: input.date, time: input.time, existingVenueId: input.existingVenueId })}\n固定 ID：${id}；固定 slug：${slug}；状态 draft；版本 1；更新时间 ${new Date().toISOString()}。\n${venue ? `复用场馆基础模型：${JSON.stringify(venue)}` : `新场馆公开搜索结果：${JSON.stringify(research)}`}\n请读取图片中的全部票区、票档、舞台、延伸台和控台相对关系，生成完整 simulation。${venue ? "必须原样复用给定场馆的 id、公开资料、建筑模型和看台参数，只为本场生成新的 layout 与 theme。" : `新场馆 venue.id 使用 venue_${crypto.randomUUID().replaceAll("-", "")}。`}meta.aliases 包含常见场馆别名。render 默认使用 58 度中心视野、1.62 米坐姿眼高、1.75 米人物高度、5 米距离取整。` },
          { type: "image", image: input.imageBase64, mediaType: input.imageType },
        ],
      }],
    });

    const simulation = simulationSchema.parse({
      ...generated.object,
      ...(venue ? { venue } : {}),
      meta: {
        ...generated.object.meta,
        id,
        slug,
        status: "draft",
        version: 1,
        updatedAt: new Date().toISOString(),
        referenceImageKey: undefined,
        referenceImageUrl: undefined,
      },
    });

    const extension = input.imageType === "image/png" ? "png" : input.imageType === "image/webp" ? "webp" : "jpg";
    const referenceImageKey = `simulations/${id}/seat-map.${extension}`;
    const bytes = Buffer.from(input.imageBase64, "base64");
    const upload = await supabase.storage.from("seatview-assets").upload(referenceImageKey, bytes, {
      contentType: input.imageType,
      upsert: false,
    });
    if (upload.error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: upload.error.message });
    simulation.meta.referenceImageKey = referenceImageKey;

    const venueUpsert = await supabase.from("venues").upsert({
      id: simulation.venue.id,
      name: simulation.venue.name,
      city: simulation.venue.city,
      aliases: simulation.venue.aliases,
      public_facts: simulation.venue.publicFacts,
      sources: simulation.venue.sources,
      model: simulation.venue.model,
      stand_tiers: simulation.venue.standTiers,
      updated_at: new Date().toISOString(),
    });
    if (venueUpsert.error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: venueUpsert.error.message });
    await persistSimulation(simulation);
    return simulation;
  }),

  publish: adminQuery.input(z.object({ slug: z.string().min(1) })).mutation(async ({ input }) => {
    const { data, error } = await requireSupabase()
      .from("simulations").select("data").eq("slug", input.slug).maybeSingle();
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "草稿不存在" });
    const simulation = simulationSchema.parse((data as { data: Simulation }).data);
    simulation.meta.status = "published";
    simulation.meta.version += 1;
    simulation.meta.updatedAt = new Date().toISOString();
    await persistSimulation(simulation);
    return { ok: true, slug: simulation.meta.slug };
  }),
});
