import "server-only";
import type { CoachingClient } from "@/lib/coaching/ai-client";
import { coachingResponseSchema, crossCheckCoachingResponse } from "@/lib/coaching/contract";

const attempted = new Set<string>();

export function createCoachingClient(): CoachingClient {
  return { async requestCoaching(request) {
    // Unique player headers isolate each browser case. First request fails;
    // retry passes through the same schema and semantic validation as real AI.
    const key = request.payload.userMessage;
    if (!attempted.has(key)) {
      attempted.add(key);
      return { status: "API_ERROR", message: "Synthetic provider failure" };
    }
    const response = coachingResponseSchema.parse({
      schemaVersion: 1,
      summary: "Deterministic coaching fixture: review candidate moves before committing.",
      strengths: ["You completed the game review."],
      improvements: ["Compare candidate moves."],
      criticalMoments: [...request.selectedPlies].map(ply => ({
        ply, classification: "mistake", headline: `Fixture lesson at ply ${ply}`,
        explanation: `The supplied engine facts identify a loss at ply ${ply}.`,
        lesson: "Compare the supplied alternative before playing.", category: "calculation.candidate_moves",
      })),
    });
    const { annotation } = crossCheckCoachingResponse({ ...request, response, model: "e2e-fixture" });
    if (!annotation) return { status: "INVALID_RESPONSE", message: "Fixture validation failed" };
    return { status: "OK", annotation };
  } };
}
