import {
  DEFAULT_MODEL_CONFIG,
  modelConfigSchema,
  type ModelConfig,
} from "@contracts/model-config";

const STORAGE_KEY = "seatview.model-config.v1";

export function loadModelConfig(): ModelConfig {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_MODEL_CONFIG };
    const parsed = modelConfigSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : { ...DEFAULT_MODEL_CONFIG };
  } catch {
    return { ...DEFAULT_MODEL_CONFIG };
  }
}

export function saveModelConfig(config: ModelConfig) {
  const parsed = modelConfigSchema.parse(config);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}
