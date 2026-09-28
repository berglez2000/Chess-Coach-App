import { z } from "zod";

export const providerSchema = z.enum(["ANTHROPIC", "OPENAI"]);
export type CoachingProvider = z.infer<typeof providerSchema>;
export const PROVIDERS = {
  ANTHROPIC: { label: "Anthropic (Claude)", model: "claude-haiku-4-5", key: "ANTHROPIC_API_KEY" },
  OPENAI: { label: "OpenAI (GPT)", model: "gpt-5.4-mini", key: "OPENAI_API_KEY" },
} as const;
export const DEFAULT_PROVIDER: CoachingProvider = "ANTHROPIC";
export const COACHING_LEASE_MS = 300_000;
export const PROVIDER_TIMEOUT_MS = 120_000;
export const COACHING_DEADLINE_MS = 150_000;
export const PROVIDER_MAX_RETRIES = 0;
export interface CoachingSettings {
  provider: CoachingProvider;
  available: Record<CoachingProvider, boolean>;
}
