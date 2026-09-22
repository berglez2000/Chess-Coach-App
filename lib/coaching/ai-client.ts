import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { coachingResponseSchema, crossCheckCoachingResponse, type CoachingAnnotation } from "@/lib/coaching/contract";
import type { CoachingPromptPayload } from "@/lib/coaching/prompt";
import type { MoveQuality } from "@/types/analysis";

export const COACHING_MODEL = "claude-haiku-4-5";

export type CoachingOutcome =
  | { status: "OK"; annotation: CoachingAnnotation }
  | { status: "MISSING_KEY" }
  | { status: "REFUSAL" }
  | { status: "INCOMPLETE_OUTPUT" }
  | { status: "TIMEOUT" }
  | { status: "RATE_LIMIT" }
  | { status: "API_ERROR"; message: string }
  | { status: "INVALID_RESPONSE"; message: string };

export interface CoachingRequest {
  payload: CoachingPromptPayload;
  gamePlies: Set<number>;
  selectedPlies: Set<number>;
  engineQuality: Map<number, MoveQuality>;
  model?: string;
}

export interface CoachingClient {
  requestCoaching(request: CoachingRequest): Promise<CoachingOutcome>;
}

export function createAnthropicClient(apiKey?: string): Anthropic {
  return new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
}

export class AnthropicCoachingClient implements CoachingClient {
  constructor(private readonly client: Anthropic) {}

  async requestCoaching(request: CoachingRequest): Promise<CoachingOutcome> {
    const { payload, gamePlies, selectedPlies, engineQuality } = request;
    const model = request.model ?? COACHING_MODEL;

    let rawText: string;
    let stopReason: string | null | undefined;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: payload.systemPrompt,
        messages: [{ role: "user", content: payload.userMessage }],
        output_config: {
          format: {
            type: "json_schema",
            schema: payload.responseSchema as Record<string, unknown>,
          },
        },
      });

      stopReason = response.stop_reason;

      if (stopReason === "refusal") return { status: "REFUSAL" };
      if (stopReason === "max_tokens") return { status: "INCOMPLETE_OUTPUT" };

      const block = response.content.find(b => b.type === "text");
      if (!block || block.type !== "text") {
        return { status: "INVALID_RESPONSE", message: "No text block in response." };
      }
      rawText = block.text;
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) return { status: "MISSING_KEY" };
      if (err instanceof Anthropic.RateLimitError) return { status: "RATE_LIMIT" };
      if (err instanceof Anthropic.APIConnectionError) return { status: "TIMEOUT" };
      if (err instanceof Anthropic.InternalServerError) return { status: "API_ERROR", message: err.message };
      if (err instanceof Anthropic.APIError) return { status: "API_ERROR", message: err.message };
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { status: "INVALID_RESPONSE", message: "Response was not valid JSON." };
    }

    const schemaResult = coachingResponseSchema.safeParse(parsed);
    if (!schemaResult.success) {
      return { status: "INVALID_RESPONSE", message: schemaResult.error.message };
    }

    const { result, annotation } = crossCheckCoachingResponse({
      response: schemaResult.data,
      gamePlies,
      selectedPlies,
      engineQuality,
      model,
    });

    if (!result.ok || !annotation) {
      return { status: "INVALID_RESPONSE", message: result.errors.map(e => e.message).join("; ") };
    }

    return { status: "OK", annotation };
  }
}

export function createCoachingClient(): CoachingClient {
  return new AnthropicCoachingClient(createAnthropicClient());
}
