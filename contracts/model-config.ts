import { z } from "zod";

export const modelConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().max(500).default(""),
  modelName: z.string().trim().min(1).max(160),
  visionModelName: z.string().trim().max(160).default(""),
  searchProvider: z.enum(["none", "tavily"]),
  searchBaseUrl: z.string().url().or(z.literal("")).default(""),
  searchApiKey: z.string().max(500).default(""),
});

export const usableModelConfigSchema = modelConfigSchema.extend({
  apiKey: z.string().trim().min(1).max(500),
});

export type ModelConfig = z.infer<typeof modelConfigSchema>;

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  baseUrl: "",
  apiKey: "",
  modelName: "",
  visionModelName: "",
  searchProvider: "none",
  searchBaseUrl: "",
  searchApiKey: "",
};
