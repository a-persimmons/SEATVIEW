import { z } from "zod";
import { TRPCError } from "@trpc/server";
import defaultSimulationJson from "@contracts/default-simulation.json";
import {
  simulationSchema,
  toSimulationSummary,
  type Simulation,
  type SimulationSummary,
} from "@contracts/simulation";
import { adminQuery, createRouter, publicQuery } from "./middleware";
import { getSupabase, isSupabaseConfigured } from "./supabase";

const defaultSimulation = simulationSchema.parse(defaultSimulationJson);

type SimulationRow = {
  id: string;
  slug: string;
  data: Simulation;
};

const searchInput = z.object({
  query: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().max(50).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  limit: z.number().int().min(1).max(60).optional().default(30),
});

function filterDefault(input: z.infer<typeof searchInput>): SimulationSummary[] {
  const keyword = input.query.toLocaleLowerCase();
  if (
    (keyword && ![
      defaultSimulation.meta.title,
      defaultSimulation.meta.shortTitle,
      defaultSimulation.meta.artist,
      defaultSimulation.meta.series,
      defaultSimulation.meta.city,
      defaultSimulation.meta.venueName,
      ...defaultSimulation.meta.aliases,
    ].some((value) => value.toLocaleLowerCase().includes(keyword))) ||
    (input.city && input.city !== defaultSimulation.meta.city) ||
    (input.date && input.date !== defaultSimulation.meta.date)
  ) return [];
  return [toSimulationSummary(defaultSimulation)].slice(0, input.limit);
}

function escapeFilter(value: string) {
  return value.replace(/[%,().]/g, " ").trim();
}

async function listPublished(input: z.infer<typeof searchInput>) {
  if (!isSupabaseConfigured()) return filterDefault(input);
  const supabase = getSupabase();
  let request = supabase
    .from("simulations")
    .select("id,slug,data")
    .eq("status", "published")
    .order("event_date", { ascending: true })
    .limit(input.limit);
  const keyword = escapeFilter(input.query);
  if (keyword) {
    request = request.or([
      `title.ilike.%${keyword}%`,
      `artist.ilike.%${keyword}%`,
      `venue_name.ilike.%${keyword}%`,
      `city.ilike.%${keyword}%`,
      `search_text.ilike.%${keyword}%`,
    ].join(","));
  }
  if (input.city) request = request.eq("city", input.city);
  if (input.date) request = request.eq("event_date", input.date);
  const { data, error } = await request;
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  const published = (data as SimulationRow[]).map((row) =>
    toSimulationSummary(simulationSchema.parse(row.data)),
  );
  const builtIn = filterDefault(input).filter((item) =>
    !published.some((publishedItem) => publishedItem.id === item.id),
  );
  return [...builtIn, ...published].slice(0, input.limit);
}

export async function persistSimulation(simulation: Simulation) {
  const row = {
    id: simulation.meta.id,
    venue_id: simulation.venue.id,
    slug: simulation.meta.slug,
    title: simulation.meta.title,
    artist: simulation.meta.artist,
    city: simulation.meta.city,
    venue_name: simulation.meta.venueName,
    event_date: simulation.meta.date,
    event_time: simulation.meta.time,
    status: simulation.meta.status,
    version: simulation.meta.version,
    data: simulation,
    poster_key: simulation.meta.posterKey || null,
    reference_image_key: simulation.meta.referenceImageKey || null,
    search_text: [
      simulation.meta.title,
      simulation.meta.shortTitle,
      simulation.meta.artist,
      simulation.meta.series,
      simulation.meta.venueName,
      simulation.meta.city,
      ...simulation.meta.aliases,
    ].join(" "),
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabase().from("simulations").upsert(row);
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
}

export const simulationRouter = createRouter({
  list: publicQuery.input(searchInput).query(async ({ input }) => ({
    items: await listPublished(input),
    source: isSupabaseConfigured() ? "supabase" as const : "built-in" as const,
  })),

  cities: publicQuery.query(async () => {
    if (!isSupabaseConfigured()) return [defaultSimulation.meta.city];
    const { data, error } = await getSupabase()
      .from("simulations")
      .select("city")
      .eq("status", "published")
      .order("city", { ascending: true });
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return [...new Set([
      defaultSimulation.meta.city,
      ...(data as { city: string }[]).map((row) => row.city),
    ])];
  }),

  bySlug: publicQuery
    .input(z.object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/) }))
    .query(async ({ input }) => {
      if (input.slug === defaultSimulation.meta.slug) return defaultSimulation;
      if (!isSupabaseConfigured()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到这个演出模拟器" });
      }
      const { data, error } = await getSupabase()
        .from("simulations")
        .select("data")
        .eq("slug", input.slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "未找到这个演出模拟器" });
      const simulation = simulationSchema.parse((data as { data: Simulation }).data);
      if (simulation.meta.referenceImageKey) {
        const { data: signed, error: signError } = await getSupabase()
          .storage.from("seatview-assets")
          .createSignedUrl(simulation.meta.referenceImageKey, 600);
        if (signError) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: signError.message });
        }
        simulation.meta.referenceImageUrl = signed.signedUrl;
      }
      return simulation;
    }),

  save: adminQuery.input(z.object({ simulation: simulationSchema })).mutation(async ({ input }) => {
    await persistSimulation(input.simulation);
    return { ok: true, slug: input.simulation.meta.slug };
  }),
});
