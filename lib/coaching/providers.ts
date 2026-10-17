import { z } from "zod";

export const providerSchema = z.enum(["ANTHROPIC", "OPENAI", "DEEPSEEK"]);
export type CoachingProvider = z.infer<typeof providerSchema>;
export const PROVIDERS = {
  ANTHROPIC: { label: "Anthropic (Claude)", model: "claude-haiku-4-5", key: "ANTHROPIC_API_KEY" },
  OPENAI: { label: "OpenAI (GPT)", model: "gpt-5.4-mini", key: "OPENAI_API_KEY" },
  DEEPSEEK: { label: "DeepSeek", model: "deepseek-flash", key: "DEEPSEEK_API_KEY" },
} as const;
export const COACHING_MODELS = {
  ANTHROPIC: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  ],
  OPENAI: [
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano" },
    { id: "gpt-5.4", label: "GPT-5.4" },
  ],
  DEEPSEEK: [
    { id: "deepseek-flash", label: "DeepSeek Flash" },
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  ],
} as const;

export function resolveCoachingModel(provider: CoachingProvider, model?: string | null): string {
  providerSchema.parse(provider);
  const selected = model ?? PROVIDERS[provider].model;
  if (!COACHING_MODELS[provider].some(option => option.id === selected)) {
    throw new Error("Choose a supported model for the selected provider.");
  }
  return selected;
}

export const coachingSelectionSchema = z.object({ provider: providerSchema, model: z.string().optional() }).strict()
  .superRefine(({ provider, model }, ctx) => {
    if (model !== undefined && !COACHING_MODELS[provider].some(option => option.id === model)) {
      ctx.addIssue({ code: "custom", path: ["model"], message: "Choose a supported model for the selected provider." });
    }
  }).transform(({ provider, model }) => ({ provider, model: resolveCoachingModel(provider, model) }));
export interface CoachingSelection {
  provider: CoachingProvider;
  model: string;
}
export const DEFAULT_PROVIDER: CoachingProvider = "ANTHROPIC";
export const COACHING_LEASE_MS = 300_000;
export const PROVIDER_TIMEOUT_MS = 120_000;
export const COACHING_DEADLINE_MS = 150_000;
export const PROVIDER_MAX_RETRIES = 0;
export interface CoachingSettings extends CoachingSelection {
  available: Record<CoachingProvider, boolean>;
}
