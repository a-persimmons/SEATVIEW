import { generateObject, generateText, streamObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import defaultSimulationJson from "@contracts/default-simulation.json";
import { simulationSchema, toSimulationSummary, type Simulation } from "@contracts/simulation";
import { recognizedEventSchema, researchSourceSchema } from "@contracts/builder";
import { usableModelConfigSchema, type ModelConfig } from "@contracts/model-config";
import { createRouter, publicQuery } from "./middleware";
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

function modelProviderOptions(modelName: string) {
  return modelName.startsWith("kimi-")
    ? { openaiCompatible: { reasoningEffort: "low" } }
    : undefined;
}

function normalizeVenueName(value: string) {
  return value.toLocaleLowerCase().replace(/[\s·•\-—_（）()]/g, "");
}

async function matchReusableVenue(venueName: string) {
  const target = normalizeVenueName(venueName);
  if (!target) return "";
  const matches = (names: string[]) => names.some((name) => normalizeVenueName(name) === target);
  if (matches([defaultSimulation.venue.name, ...defaultSimulation.venue.aliases])) {
    return defaultSimulation.venue.id;
  }
  if (!isSupabaseConfigured()) return "";
  const { data, error } = await getSupabase().from("venues").select("id,name,aliases");
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  const row = (data as { id: string; name: string; aliases: string[] }[]).find((item) =>
    matches([item.name, ...(item.aliases || [])]),
  );
  return row?.id || "";
}

async function getVenueById(id: string): Promise<Simulation["venue"] | null> {
  if (id === defaultSimulation.venue.id) return defaultSimulation.venue;
  const { data, error } = await requireSupabase().from("venues").select("*").eq("id", id).maybeSingle();
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data) return null;
  const row = data as {
    id: string; name: string; city: string; aliases: string[];
    public_facts: string[]; sources: { label: string; url: string; note?: string }[];
    model: Simulation["venue"]["model"]; stand_tiers: Simulation["venue"]["standTiers"];
  };
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    aliases: row.aliases || [],
    publicFacts: row.public_facts || [],
    sources: row.sources || [],
    model: row.model,
    standTiers: row.stand_tiers,
  };
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

const imageInput = {
  imageBase64: z.string().min(100).max(18_000_000),
  imageType: z.enum(["image/png", "image/jpeg", "image/webp"]),
};

const confirmedEventInput = {
  title: z.string().trim().min(1).max(120),
  artist: z.string().trim().min(1).max(120),
  venueName: z.string().trim().min(1, { message: "VENUE_NAME_REQUIRED" }).max(160),
  city: z.string().trim().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  existingVenueId: z.string().optional().default(""),
};

const recognitionInput = z.object({
  modelConfig: usableModelConfigSchema,
  ...imageInput,
});

const researchInput = z.object({
  venueName: z.string().trim().min(1, { message: "VENUE_NAME_REQUIRED" }).max(160),
  city: z.string().trim().min(1).max(60),
  existingVenueId: z.string().optional().default(""),
  modelConfig: usableModelConfigSchema,
});

const generateInput = z.object({
  ...confirmedEventInput,
  modelConfig: usableModelConfigSchema,
  research: z.array(researchSourceSchema).max(6).default([]),
  ...imageInput,
});

export const builderRouter = createRouter({
  testConfig: publicQuery.input(usableModelConfigSchema).mutation(async ({ input }) => {
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

  venues: publicQuery.query(async () => {
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

  listAll: publicQuery.query(async () => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await getSupabase()
      .from("simulations")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(40);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return (data as { data: Simulation }[]).map((row) => toSimulationSummary(simulationSchema.parse(row.data)));
  }),

  recognize: publicQuery.input(recognitionInput).mutation(async ({ input }) => {
    const config = input.modelConfig;
    const visionModel = config.visionModelName || config.modelName;
    try {
      const generated = await generateObject({
        model: provider(config)(visionModel),
        providerOptions: modelProviderOptions(visionModel),
        schema: recognizedEventSchema,
        system: "你是演唱会宣传图信息提取器。只提取图片中明确可见的演出名称、演出主题或艺人、城市、场馆全称、日期和开始时间，不分析座位布局，不联网，不猜测。无法确认的文本字段返回空字符串。日期统一为 YYYY-MM-DD，时间统一为 24 小时制 HH:mm。场馆必须尽量保留完整正式名称，不得把城市名当作场馆名。",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "请读取这张完整的大麦 App 或主办方演唱会 2D 图，仅返回可确认的六项基本信息。" },
            { type: "image", image: input.imageBase64, mediaType: input.imageType },
          ],
        }],
      });
      const recognized = recognizedEventSchema.parse(generated.object);
      return {
        ...recognized,
        existingVenueId: await matchReusableVenue(recognized.venueName),
      };
    } catch (reason) {
      if (reason instanceof TRPCError) throw reason;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "图片信息识别失败，请检查视觉模型配置或更换清晰原图" });
    }
  }),

  research: publicQuery.input(researchInput).mutation(async ({ input }) => {
    if (input.existingVenueId) {
      const venue = await getVenueById(input.existingVenueId);
      if (!venue) throw new TRPCError({ code: "NOT_FOUND", message: "未找到要复用的场馆，请改为新场馆检索" });
      return { mode: "reuse" as const, venue, research: [] };
    }
    const research = await searchVenue(input.venueName, input.city, input.modelConfig);
    return { mode: "search" as const, venue: null, research };
  }),

  generate: publicQuery.input(generateInput).mutation(async ({ input }) => {
    const config = input.modelConfig;
    const visionModel = config.visionModelName || config.modelName;
    const venue = input.existingVenueId ? await getVenueById(input.existingVenueId) : null;
    if (input.existingVenueId && !venue) {
      throw new TRPCError({ code: "NOT_FOUND", message: "未找到要复用的场馆，请返回上一步重新检索" });
    }
    if (!venue && !input.research.length) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "RESEARCH_REQUIRED" });
    }

    const id = `sim_${crypto.randomUUID().replaceAll("-", "")}`;
    const slug = `event-${Date.now().toString(36)}`;
    let generatedObject: Simulation;
    try {
      const generated = streamObject({
        model: provider(config)(visionModel),
        providerOptions: modelProviderOptions(visionModel),
        schema: simulationSchema,
        system: `你是演唱会场馆模拟器的数据建模器。根据用户确认的演出信息、已检索公开建筑资料和一张主办方 2D 分区图，生成可直接渲染的完整 JSON。不得生成座椅逐点坐标，座椅由客户端规则生成。舞台位于负 Z 方向，所有分区坐标使用米。票档颜色必须彼此可区分，文字主题颜色保持高对比。公开建筑参数只能来自给定资料，不确定的尺度使用明确估算，不得编造官方排号。`,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `用户已确认的演出信息：${JSON.stringify({ title: input.title, artist: input.artist, venueName: input.venueName, city: input.city, date: input.date, time: input.time, existingVenueId: input.existingVenueId })}\n固定 ID：${id}；固定 slug：${slug}；状态 draft；版本 1；更新时间 ${new Date().toISOString()}。\n${venue ? `复用场馆基础模型：${JSON.stringify(venue)}` : `用户确认后检索到的新场馆公开资料：${JSON.stringify(input.research)}`}\n请读取图片中的全部票区、票档、舞台、延伸台和控台相对关系，生成完整 simulation。${venue ? "必须原样复用给定场馆的 id、公开资料、建筑模型和看台参数，只为本场生成新的 layout 与 theme。" : `新场馆 venue.id 使用 venue_${crypto.randomUUID().replaceAll("-", "")}。`}meta.aliases 包含常见场馆别名。render 默认使用 58 度中心视野、1.62 米坐姿眼高、1.75 米人物高度、5 米距离取整。` },
            { type: "image", image: input.imageBase64, mediaType: input.imageType },
          ],
        }],
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(300_000),
      });
      for await (const partial of generated.partialObjectStream) void partial;
      generatedObject = await generated.object;
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason);
      const timedOut = /timeout|timed out|aborted/i.test(detail);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: timedOut
          ? "模型生成超过 5 分钟，已停止本次请求，请重试或改用响应更快的视觉模型"
          : `模型生成连接失败：${detail}`,
      });
    }

    return simulationSchema.parse({
      ...generatedObject,
      ...(venue ? { venue } : {}),
      meta: {
        ...generatedObject.meta,
        id,
        slug,
        status: "draft",
        version: 1,
        updatedAt: new Date().toISOString(),
        referenceImageKey: undefined,
        referenceImageUrl: undefined,
      },
    });
  }),

  saveDraft: publicQuery.input(z.object({
    simulation: simulationSchema,
    ...imageInput,
  })).mutation(async ({ input }) => {
    const supabase = requireSupabase();
    const simulation = input.simulation;
    if (simulation.meta.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "只有构建草稿可以通过此接口保存" });
    }
    if (simulation.meta.slug === defaultSimulation.meta.slug) {
      throw new TRPCError({ code: "CONFLICT", message: "默认河北奥体样本不可被上传构建覆盖" });
    }
    const extension = input.imageType === "image/png" ? "png" : input.imageType === "image/webp" ? "webp" : "jpg";
    const referenceImageKey = `simulations/${simulation.meta.id}/seat-map.${extension}`;
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

  publish: publicQuery.input(z.object({ slug: z.string().min(1) })).mutation(async ({ input }) => {
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
