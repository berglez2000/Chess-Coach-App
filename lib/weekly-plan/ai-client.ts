import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { PROVIDERS, providerSchema, type CoachingProvider } from "@/lib/coaching/providers";
import { providerSchemaShape } from "@/lib/coaching/schema";
import { buildPlanPrompt } from "./prompt";
import { PlanError, validatePlan, type PlanInputs, type PlanDefinition } from "./contract";
export const PLAN_TIMEOUT_MS = 60_000;
export type PlanOutcome = { status: "OK"; definition: PlanDefinition; model: string } | { status: "FAILED"; message: string };
export interface PlanClient { generate(inputs: PlanInputs, signal: AbortSignal): Promise<PlanOutcome> }
const options = { timeout: PLAN_TIMEOUT_MS, maxRetries: 0 };
function checked(text: string, inputs: PlanInputs, model: string): PlanOutcome {
  try { return { status: "OK", definition: { ...validatePlan(JSON.parse(text), inputs), title: "Weekly chess study" }, model }; }
  catch (error) { return { status: "FAILED", message: error instanceof PlanError ? `The provider proposed an invalid schedule. ${error.message}` : "The provider did not return a valid plan. Try generating again." }; }
}
function failure(error: unknown, signal: AbortSignal): PlanOutcome {
  if (signal.aborted || error instanceof OpenAI.APIConnectionError || error instanceof Anthropic.APIConnectionError) return { status: "FAILED", message: "Plan generation timed out. Your accepted plan is preserved; try again." };
  if (error instanceof OpenAI.AuthenticationError || error instanceof Anthropic.AuthenticationError) return { status: "FAILED", message: "The selected provider's API key was rejected. Check provider settings." };
  if (error instanceof OpenAI.RateLimitError || error instanceof Anthropic.RateLimitError) return { status: "FAILED", message: "The selected provider is rate limited. Try again later." };
  return { status: "FAILED", message: "The selected provider could not generate a plan. Your accepted plan is preserved; try again." };
}
export class OpenAIPlanClient implements PlanClient {
  constructor(private client: OpenAI, private model = PROVIDERS.OPENAI.model as string) {}
  async generate(inputs: PlanInputs, signal: AbortSignal): Promise<PlanOutcome> {
    const prompt = buildPlanPrompt(inputs);
    try {
      const response = await this.client.responses.create({ model: this.model, store: false, max_output_tokens: 4096, reasoning: { effort: "low" },
        instructions: prompt.systemPrompt, input: prompt.userMessage,
        text: { format: { type: "json_schema", name: "weekly_chess_plan", strict: true, schema: providerSchemaShape(prompt.responseSchema) } },
      }, { signal });
      if (response.output.some(item => item.type === "message" && item.content.some(block => block.type === "refusal"))) return { status: "FAILED", message: "The provider declined to generate this plan. Update your learning profile and try again." };
      if (response.status !== "completed") return { status: "FAILED", message: "The provider returned an incomplete plan. Try generating again." };
      return checked(response.output_text, inputs, response.model);
    } catch (error) { return failure(error, signal); }
  }
}
export class AnthropicPlanClient implements PlanClient {
  constructor(private client: Anthropic, private model = PROVIDERS.ANTHROPIC.model as string) {}
  async generate(inputs: PlanInputs, signal: AbortSignal): Promise<PlanOutcome> {
    const prompt = buildPlanPrompt(inputs);
    try {
      const response = await this.client.messages.create({ model: this.model, max_tokens: 4096, system: prompt.systemPrompt,
        messages: [{ role: "user", content: prompt.userMessage }], output_config: { format: { type: "json_schema", schema: providerSchemaShape(prompt.responseSchema) } },
      }, { signal });
      if (response.stop_reason === "refusal") return { status: "FAILED", message: "The provider declined to generate this plan. Update your learning profile and try again." };
      if (response.stop_reason !== "end_turn") return { status: "FAILED", message: "The provider returned an incomplete plan. Try generating again." };
      const text = response.content.filter(block => block.type === "text").map(block => block.text).join("");
      return checked(text, inputs, response.model);
    } catch (error) { return failure(error, signal); }
  }
}
export function planProviderAvailable(provider: CoachingProvider): boolean { return Boolean(process.env[PROVIDERS[provider].key]?.trim()); }
export function createPlanClient(provider: CoachingProvider): PlanClient {
  providerSchema.parse(provider);
  const config = PROVIDERS[provider];
  if (!planProviderAvailable(provider)) return { generate: async () => ({ status: "FAILED", message: "The selected provider has no API key. Configure it in the server environment and retry." }) };
  return provider === "OPENAI" ? new OpenAIPlanClient(new OpenAI({ apiKey: process.env[config.key], ...options }), config.model)
    : new AnthropicPlanClient(new Anthropic({ apiKey: process.env[config.key], ...options }), config.model);
}
