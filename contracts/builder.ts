import { z } from "zod";
import type { Simulation } from "./simulation";

export const recognizedEventSchema = z.object({
  title: z.string().trim().max(120).default(""),
  artist: z.string().trim().max(120).default(""),
  city: z.string().trim().max(60).default(""),
  venueName: z.string().trim().max(160).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).default(""),
});

export const researchSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  content: z.string().optional(),
});

export type RecognizedEvent = z.infer<typeof recognizedEventSchema>;
export type ResearchSource = z.infer<typeof researchSourceSchema>;

export type RecognitionResult = RecognizedEvent & {
  existingVenueId: string;
};

export type VenueResearchResult = {
  mode: "reuse" | "search";
  venue: Simulation["venue"] | null;
  research: ResearchSource[];
};

export const EMPTY_RECOGNIZED_EVENT: RecognizedEvent = {
  title: "",
  artist: "",
  city: "",
  venueName: "",
  date: "",
  time: "",
};
