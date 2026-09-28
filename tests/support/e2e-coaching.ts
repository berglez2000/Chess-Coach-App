import { DEFAULT_PROVIDER, type CoachingProvider } from "@/lib/coaching/providers";
import "server-only";
import type { CoachingClient } from "@/lib/coaching/ai-client";
import { coachingResponseSchema, crossCheckCoachingResponse } from "@/lib/coaching/contract";

const attempted = new Set<string>();

export function createCoachingClient(provider: CoachingProvider = DEFAULT_PROVIDER): CoachingClient {
  return { async requestCoaching(request) {
    // Unique player headers isolate each browser case. First request fails;
    // retry passes through the same schema and semantic validation as real AI.
    const gameKey = request.payload.userMessage;
    if (gameKey.includes("Missing-key fixture") && provider === "OPENAI") return { status: "MISSING_KEY" };
    // Explicit fixture metadata is shared across route bundles; module-local
    // memory is not a reliable way to infer a game's initial provider.
    const initialProvider = gameKey.includes("Initial provider: OPENAI") ? "OPENAI" : "ANTHROPIC";
    const replacing = initialProvider !== provider;
    const key = provider + gameKey;
    if (!attempted.has(key)) {
      attempted.add(key);
      return { status: "API_ERROR", message: "Synthetic provider failure" };
    }
    const response = coachingResponseSchema.parse({
      schemaVersion: 1,
      summary: "Deterministic coaching fixture: review candidate moves before committing.",
      strengths: ["You completed the game review."],
      improvements: ["Compare candidate moves."],
      criticalMoments: [...request.selectedPlies].slice(0, replacing ? 1 : undefined).map(ply => ({
        ply, classification: "mistake", headline: `Fixture lesson at ply ${ply}`,
        explanation: `The supplied engine facts identify a loss at ply ${ply}.`,
        lesson: "Compare the supplied alternative before playing.", category: "calculation.candidate_moves",
      })),
    });
    const { annotation } = crossCheckCoachingResponse({ ...request, response, model: `e2e-${provider}-fixture` });
    if (!annotation) return { status: "INVALID_RESPONSE", message: "Fixture validation failed" };
    return { status: "OK", annotation };
  } };
}
