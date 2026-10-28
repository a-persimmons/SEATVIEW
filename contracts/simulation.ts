import { z } from "zod";

export const sourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  note: z.string().optional(),
});

export const venueModelSchema = z.object({
  stageFrontZ: z.number(),
  stageCenterZ: z.number(),
  stageTargetY: z.number(),
  roofHeight: z.number().positive(),
  trackRadius: z.number().positive(),
  trackStraight: z.number().positive(),
  trackLaneWidth: z.number().positive(),
  trackLanes: z.number().int().positive(),
});

export const standTierSchema = z.object({
  innerRx: z.number().positive(),
  innerRz: z.number().positive(),
  outerRx: z.number().positive(),
  outerRz: z.number().positive(),
  innerY: z.number(),
  outerY: z.number(),
  rows: z.number().int().positive(),
});

export const priceLevelSchema = z.object({
  price: z.number().nonnegative(),
  color: z.string().min(1),
  label: z.string().min(1),
  hint: z.string(),
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  color: z.string().min(1),
  kind: z.enum(["field", "stand"]),
  x: z.number(),
  z: z.number(),
  width: z.number().nonnegative(),
  depth: z.number().nonnegative(),
  angle: z.number().optional(),
  span: z.number().optional(),
  tier: z.number().int().min(0).max(1).optional(),
  direction: z.string(),
  summary: z.string(),
  note: z.string(),
});

export const simulationThemeSchema = z.object({
  accent: z.string().min(1),
  pageBg: z.string().min(1),
  panelBg: z.string().min(1),
  panelRaised: z.string().min(1),
  panelBorder: z.string().min(1),
  textBright: z.string().min(1),
  textSoft: z.string().min(1),
  textDim: z.string().min(1),
  buttonText: z.string().min(1),
  stageAccent: z.string().min(1),
});

export const simulationSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    id: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().min(1),
    shortTitle: z.string().min(1),
    artist: z.string().min(1),
    series: z.string(),
    city: z.string().min(1),
    venueName: z.string().min(1),
    aliases: z.array(z.string()),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    weekday: z.string(),
    description: z.string(),
    status: z.enum(["draft", "published"]),
    version: z.number().int().positive(),
    updatedAt: z.string(),
    posterKey: z.string().optional(),
    referenceImageKey: z.string().optional(),
    referenceImageUrl: z.string().optional(),
  }),
  venue: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    aliases: z.array(z.string()),
    city: z.string().min(1),
    publicFacts: z.array(z.string()),
    sources: z.array(sourceSchema),
    model: venueModelSchema,
    standTiers: z.array(standTierSchema).min(1).max(2),
  }),
  layout: z.object({
    sections: z.array(sectionSchema).min(1),
    priceLevels: z.array(priceLevelSchema).min(1),
    quickSections: z.array(z.string()),
    defaultSectionId: z.string().min(1),
    controlBooth: z.object({ x: z.number(), z: z.number(), width: z.number(), depth: z.number() }),
  }),
  render: z.object({
    humanVisionFov: z.number().positive(),
    seatedEyeHeight: z.number().positive(),
    performerHeight: z.number().positive(),
    fieldRowSpacing: z.number().positive(),
    fieldColumnSpacing: z.number().positive(),
    distanceRounding: z.number().positive(),
    fieldUncertainty: z.number().nonnegative(),
    standUncertainty: z.number().nonnegative(),
  }),
  theme: simulationThemeSchema,
});

export type Simulation = z.infer<typeof simulationSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type VenueModel = z.infer<typeof venueModelSchema>;
export type StandTier = z.infer<typeof standTierSchema>;
export type PriceLevel = z.infer<typeof priceLevelSchema>;
export type SimulationTheme = z.infer<typeof simulationThemeSchema>;
export type SimulationSource = z.infer<typeof sourceSchema>;

export type SimulationSummary = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  artist: string;
  series: string;
  city: string;
  venueName: string;
  aliases: string[];
  date: string;
  time: string;
  weekday: string;
  description: string;
  status: "draft" | "published";
  version: number;
  updatedAt: string;
  posterKey?: string;
  theme: Pick<SimulationTheme, "accent" | "pageBg" | "panelBg" | "stageAccent">;
  sectionCount: number;
  startingPrice: number;
};

export function toSimulationSummary(simulation: Simulation): SimulationSummary {
  return {
    ...simulation.meta,
    theme: {
      accent: simulation.theme.accent,
      pageBg: simulation.theme.pageBg,
      panelBg: simulation.theme.panelBg,
      stageAccent: simulation.theme.stageAccent,
    },
    sectionCount: simulation.layout.sections.length,
    startingPrice: Math.min(...simulation.layout.priceLevels.map((level) => level.price)),
  };
}
