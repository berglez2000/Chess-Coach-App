import "server-only";
import { providerSchemaShape } from "./schema";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { coachingResponseSchema, crossCheckCoachingResponse, type CoachingAnnotation } from "./contract";
import { DEFAULT_PROVIDER, PROVIDERS, PROVIDER_MAX_RETRIES, PROVIDER_TIMEOUT_MS, providerSchema, type CoachingProvider } from "./providers";
import type { CoachingPromptPayload } from "./prompt";
import type { MoveQuality } from "@/types/analysis";

export const COACHING_MODEL = PROVIDERS.ANTHROPIC.model;
export type CoachingOutcome =
  | { status: "OK"; annotation: CoachingAnnotation }
  | { status: "MISSING_KEY" | "REFUSAL" | "INCOMPLETE_OUTPUT" | "TIMEOUT" | "RATE_LIMIT" }
  | { status: "API_ERROR" | "INVALID_RESPONSE"; message: string };
export interface CoachingRequest {
  payload: CoachingPromptPayload;
  gamePlies: Set<number>;
  selectedPlies: Set<number>;
  engineQuality: Map<number, MoveQuality>;
  signal?: AbortSignal;
}
export interface CoachingClient {
  requestCoaching(request: CoachingRequest): Promise<CoachingOutcome>;
}

export { providerSchemaShape } from "./schema";

function validateResponse(text: string, request: CoachingRequest, model: string): CoachingOutcome {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { status: "INVALID_RESPONSE", message: "Response was not valid JSON." }; }
  const validated = coachingResponseSchema.safeParse(parsed);
  if (!validated.success) return { status: "INVALID_RESPONSE", message: "Coaching did not match the required format." };
  const { annotation } = crossCheckCoachingResponse({ ...request, response: validated.data, model });
  return annotation ? { status: "OK", annotation } : { status: "INVALID_RESPONSE", message: "Coaching referenced unsupported moments." };
}
const sdkOptions = { timeout: PROVIDER_TIMEOUT_MS, maxRetries: PROVIDER_MAX_RETRIES };
export function createAnthropicClient(apiKey?: string): Anthropic {
  return new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY, ...sdkOptions });
}
export function createOpenAIClient(apiKey?: string): OpenAI {
  return new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY, ...sdkOptions });
}

export class AnthropicCoachingClient implements CoachingClient {
  constructor(private readonly client: Anthropic, private readonly model: string = COACHING_MODEL) {}
  async requestCoaching(request: CoachingRequest): Promise<CoachingOutcome> {
    try {
      const response = await this.client.messages.create({
        model: this.model, max_tokens: 4096,
        system: request.payload.systemPrompt,
        messages: [{ role: "user", content: request.payload.userMessage }],
        output_config: { format: { type: "json_schema", schema: providerSchemaShape(request.payload.responseSchema) } },
      }, { signal: request.signal });
      if (response.stop_reason === "refusal") return { status: "REFUSAL" };
      if (response.stop_reason === "max_tokens") return { status: "INCOMPLETE_OUTPUT" };
      const block = response.content.find(b => b.type === "text");
      if (!block || block.type !== "text") return { status: "INVALID_RESPONSE", message: "No text block in response." };
      return validateResponse(block.text, request, response.model);
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) return { status: "MISSING_KEY" };
      if (error instanceof Anthropic.RateLimitError) return { status: "RATE_LIMIT" };
      if (request.signal?.aborted || error instanceof Anthropic.APIConnectionError) return { status: "TIMEOUT" };
      if (error instanceof Anthropic.APIError) return { status: "API_ERROR", message: "Coaching provider request failed." };
      throw error;
    }
  }
}
export class OpenAICoachingClient implements CoachingClient {
  constructor(private readonly client: OpenAI, private readonly model: string = PROVIDERS.OPENAI.model) {}
  async requestCoaching(request: CoachingRequest): Promise<CoachingOutcome> {
    try {
      const response = await this.client.responses.create({
        model: this.model, store: false, max_output_tokens: 8192,
        reasoning: { effort: "low" },
        instructions: request.payload.systemPrompt, input: request.payload.userMessage,
        text: { format: { type: "json_schema", name: "chess_coaching", strict: true, schema: providerSchemaShape(request.payload.responseSchema) } },
      }, { signal: request.signal });
      if (response.output.some(item => item.type === "message" && item.content.some(block => block.type === "refusal"))) return { status: "REFUSAL" };
      if (response.status === "incomplete") return { status: "INCOMPLETE_OUTPUT" };
      if (response.status !== "completed") return { status: "API_ERROR", message: "Coaching provider request failed." };
      return validateResponse(response.output_text, request, response.model);
    } catch (error) {
      if (error instanceof OpenAI.AuthenticationError) return { status: "MISSING_KEY" };
      if (error instanceof OpenAI.RateLimitError) return { status: "RATE_LIMIT" };
      if (request.signal?.aborted || error instanceof OpenAI.APIConnectionError) return { status: "TIMEOUT" };
      if (error instanceof OpenAI.APIError) return { status: "API_ERROR", message: "Coaching provider request failed." };
      throw error;
    }
  }
}
export function createCoachingClient(provider: CoachingProvider = DEFAULT_PROVIDER): CoachingClient {
  providerSchema.parse(provider);
  const config = PROVIDERS[provider];
  if (!process.env[config.key]?.trim()) return { requestCoaching: async () => ({ status: "MISSING_KEY" }) };
  return provider === "ANTHROPIC"
    ? new AnthropicCoachingClient(createAnthropicClient(), config.model)
    : new OpenAICoachingClient(createOpenAIClient(), config.model);
}
