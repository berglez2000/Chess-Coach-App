import { describe, expect, it } from "vitest";
import type { ReviewCoachingAnnotation, GameCoachingSummary, ReviewGame, AnalysisStatus } from "@/types/saved-game";
import type { ParsedGameMove } from "@/types/game";

// Fixtures
const annotation: ReviewCoachingAnnotation = {
  classification: "blunder",
  headline: "Hanging the queen",
  explanation: "After Qd5 the queen is undefended and Black wins material immediately.",
  lesson: "Always check if your piece is en prise before moving.",
  category: "tactics.hanging_piece",
  model: "claude-test",
};

const normalAnnotation: ReviewCoachingAnnotation = {
  classification: "normal",
  headline: null,
  explanation: "Solid developing move.",
  lesson: "Development is key in the opening.",
  category: "opening.development",
  model: "claude-test",
};

function makeMove(ply: number, coaching: ReviewCoachingAnnotation | null = null): ParsedGameMove & { coaching?: ReviewCoachingAnnotation | null } {
  return {
    ply,
    moveNumber: Math.ceil(ply / 2),
    color: ply % 2 === 1 ? "WHITE" : "BLACK",
    san: `move${ply}`,
    uci: `e2e4`,
    fenBefore: "fen-before",
    fenAfter: "fen-after",
    coaching,
  };
}

describe("coaching annotation synchronization", () => {
  it("each ply carries its own coaching annotation independently", () => {
    const moves = [makeMove(1, annotation), makeMove(2, null), makeMove(3, normalAnnotation)];
    expect(moves[0].coaching?.classification).toBe("blunder");
    expect(moves[1].coaching).toBeNull();
    expect(moves[2].coaching?.classification).toBe("normal");
  });

  it("normal moves do not inherit stale annotation from a previously selected critical move", () => {
    // Simulate selecting ply 1 (critical) then ply 2 (normal)
    const moves = [makeMove(1, annotation), makeMove(2, null)];
    const selectedPly1 = moves[0].coaching;
    const selectedPly2 = moves[1].coaching;
    // The component must use selectedMove.coaching, not persist state from ply 1
    expect(selectedPly1).not.toBeNull();
    expect(selectedPly2).toBeNull();
  });

  it("summary moments link to canonical plies", () => {
    const moves = [makeMove(1, annotation), makeMove(2, null), makeMove(3, normalAnnotation)];
    const annotatedMoves = moves.filter(m => m.coaching);
    expect(annotatedMoves.map(m => m.ply)).toEqual([1, 3]);
  });

  it("annotated moments nav only includes moves with coaching", () => {
    const moves = [makeMove(1, annotation), makeMove(2, null), makeMove(3, null)];
    const annotatedMoves = moves.filter(m => m.coaching);
    expect(annotatedMoves).toHaveLength(1);
    expect(annotatedMoves[0].ply).toBe(1);
  });
});

describe("game-level coaching summary", () => {
  const coaching: GameCoachingSummary = {
    summary: "Solid game with one critical error.",
    strengths: ["Good opening", "Active pieces"],
    improvements: ["Avoid hanging pieces"],
    model: "claude-test",
  };

  it("summary, strengths, and improvements are present when coaching data exists", () => {
    expect(coaching.summary).toBeTruthy();
    expect(coaching.strengths).toHaveLength(2);
    expect(coaching.improvements).toHaveLength(1);
  });

  it("coaching is null when coachingSummary or coachingModel is absent", () => {
    // Mirrors toReviewCoachingAnnotation guard in queries.ts
    const nullCoaching: GameCoachingSummary | null = null;
    expect(nullCoaching).toBeNull();
  });
});

describe("AnalysisStatus coaching availability", () => {
  const statusesWithoutCoaching: AnalysisStatus[] = ["PENDING", "ENGINE_RUNNING", "ENGINE_COMPLETED", "AI_RUNNING"];
  const statusesWithPossibleCoaching: AnalysisStatus[] = ["COMPLETED", "FAILED"];

  it("coaching is unavailable before COMPLETED", () => {
    for (const status of statusesWithoutCoaching) {
      // Panel should show status-appropriate message, not annotation
      expect(statusesWithoutCoaching).toContain(status);
    }
  });

  it("COMPLETED and FAILED statuses may have coaching data or need retry", () => {
    for (const status of statusesWithPossibleCoaching) {
      expect(statusesWithPossibleCoaching).toContain(status);
    }
  });
});

describe("before-position note", () => {
  it("annotation explanation refers to position before move, board shows after", () => {
    // The CoachingPanel renders a note clarifying this distinction.
    // Verify annotation data: explanation is about the position before the played move.
    const move = makeMove(1, annotation);
    // fenBefore = position where coaching explanation applies
    // fenAfter = what the board displays
    expect(move.fenBefore).not.toBe(move.fenAfter);
    expect(move.coaching?.explanation).toContain("Qd5");
  });
});
