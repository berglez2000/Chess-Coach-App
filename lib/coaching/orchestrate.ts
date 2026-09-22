import { randomUUID } from "node:crypto";
import type { CoachingClient } from "@/lib/coaching/ai-client";
import type { CoachingRepository } from "@/lib/coaching/repository";
import { selectMoments } from "@/lib/coaching/select-moments";
import { buildCoachingPrompt } from "@/lib/coaching/prompt";
import type { MoveAssessment } from "@/types/analysis";
import type { ParsedGameMove } from "@/types/game";

export type CoachingOutcome =
  | { status: "COMPLETED"; annotatedMoments: number }
  | { status: "NOT_FOUND" }
  | { status: "NOT_READY" }
  | { status: "NO_ENGINE_DATA" }
  | { status: "AI_FAILED"; code: string; message: string }
  | { status: "FAILED"; code: "COACHING_FAILED" | "STORAGE_FAILED"; message: string };

export async function coachGame(
  id: string,
  repository: CoachingRepository,
  client: CoachingClient,
): Promise<CoachingOutcome> {
  let claimed = false;
  try {
    const loaded = await repository.load(id);
    if (!loaded) return { status: "NOT_FOUND" };

    const hasEngine = loaded.moves.some(m => m.assessment !== null);
    if (!hasEngine) return { status: "NO_ENGINE_DATA" };

    claimed = await repository.claim(id);
    if (!claimed) return { status: "NOT_READY" };

    const runId = randomUUID();

    const assessments = loaded.moves
      .filter((m): m is typeof m & { assessment: MoveAssessment } => m.assessment !== null)
      .map(m => ({ ply: m.ply, assessment: m.assessment }));

    const moves: ParsedGameMove[] = loaded.moves.map(m => ({
      ply: m.ply,
      moveNumber: Math.ceil(m.ply / 2),
      color: m.color,
      san: m.san,
      uci: m.uci,
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
    }));

    const selectedMoments = selectMoments({
      userColor: loaded.game.userColor,
      moves,
      assessments,
    });

    const momentFacts = new Map(
      loaded.moves
        .filter(m => m.facts !== null)
        .map(m => [m.ply, m.facts!])
    );

    const payload = buildCoachingPrompt({
      userColor: loaded.game.userColor,
      game: {
        metadata: {
          whiteName: loaded.game.whiteName,
          blackName: loaded.game.blackName,
          result: loaded.game.result as import("@/types/game").GameResult,
          playedAt: loaded.game.playedAt,
          openingName: loaded.game.openingName,
          event: loaded.game.event,
          eco: loaded.game.eco,
          timeControl: loaded.game.timeControl,
          site: null,
          round: null,
          termination: null,
        },
      },
      moments: selectedMoments,
      momentFacts,
    });

    const gamePlies = new Set(loaded.moves.map(m => m.ply));
    const selectedPlies = new Set(selectedMoments.map(m => m.ply));
    const engineQuality = new Map(
      assessments
        .filter(a => a.assessment.quality !== "unknown")
        .map(a => [a.ply, a.assessment.quality] as [number, import("@/types/analysis").MoveQuality])
    );

    const outcome = await client.requestCoaching({
      payload,
      gamePlies,
      selectedPlies,
      engineQuality,
    });

    if (outcome.status !== "OK") {
      const message = coachingFailureMessage(outcome.status);
      try {
        await repository.fail(id, message);
      } catch {
        return { status: "FAILED", code: "STORAGE_FAILED", message: "Could not record coaching status. Check the database connection before retrying." };
      }
      return { status: "AI_FAILED", code: outcome.status, message };
    }

    const moveIds = new Map(loaded.moves.map(m => [m.ply, m.id]));

    await repository.save(id, runId, outcome.annotation, moveIds);
    await repository.complete(id);

    return { status: "COMPLETED", annotatedMoments: outcome.annotation.moments.length };
  } catch {
    const message = "Coaching failed. Engine analysis results are retained. Please retry.";
    if (claimed) {
      try {
        await repository.fail(id, message);
      } catch {
        return { status: "FAILED", code: "STORAGE_FAILED", message: "Could not record coaching status. Check the database connection before retrying." };
      }
    }
    return { status: "FAILED", code: "COACHING_FAILED", message };
  }
}

function coachingFailureMessage(code: string): string {
  switch (code) {
    case "MISSING_KEY": return "No AI API key configured. Engine review is available. Configure ANTHROPIC_API_KEY to enable coaching.";
    case "RATE_LIMIT": return "AI rate limit reached. Engine review is available. Retry in a moment.";
    case "TIMEOUT": return "AI request timed out. Engine review is available. Please retry.";
    case "REFUSAL": return "AI declined to coach this game. Engine review is available.";
    case "INCOMPLETE_OUTPUT": return "AI response was cut off. Engine review is available. Please retry.";
    case "API_ERROR": return "AI service error. Engine review is available. Please retry.";
    case "INVALID_RESPONSE": return "AI returned an invalid response. Engine review is available. Please retry.";
    default: return "Coaching failed. Engine review is available. Please retry.";
  }
}
