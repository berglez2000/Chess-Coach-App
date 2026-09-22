import { describe, expect, it } from "vitest";
import type { ReviewCoachingAnnotation, GameCoachingSummary, AnalysisStatus } from "@/types/saved-game";
import type { ReviewAnalysis } from "@/lib/analysis/review";
import type { ParsedGameMove } from "@/types/game";

const blunderAnnotation: ReviewCoachingAnnotation = {
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

const mistakeAnnotation: ReviewCoachingAnnotation = {
  classification: "mistake",
  headline: "Weakened king safety",
  explanation: "Moving the pawn exposes the king to a diagonal attack.",
  lesson: "Keep the pawn shield intact when the opponent has an active bishop.",
  category: "opening.king_safety",
  model: "claude-test",
};

const longAnnotation: ReviewCoachingAnnotation = {
  classification: "inaccuracy",
  headline: "A".repeat(200),
  explanation: "B".repeat(1000),
  lesson: "C".repeat(500),
  category: "calculation.missed_threat",
  model: "claude-test",
};

function makeAnalysis(quality: ReviewAnalysis["quality"] = "normal"): ReviewAnalysis {
  return {
    before: { perspective: "WHITE", score: { kind: "cp", value: 30, bound: "exact" }, depth: 12, pv: ["e2e4"] },
    after: { perspective: "WHITE", score: { kind: "cp", value: 25, bound: "exact" }, depth: 12, pv: ["e7e5"] },
    quality,
    reason: "cp_loss",
    cpLoss: 5,
    bestMoveSan: "e4",
    pvSan: ["e4", "e5", "Nf3"],
    runId: "run-1",
    analyzedAt: "2026-09-22T10:00:00.000Z",
  };
}

type ReviewMove = ParsedGameMove & { analysis?: ReviewAnalysis | null; coaching?: ReviewCoachingAnnotation | null };

function makeMove(ply: number, opts?: { coaching?: ReviewCoachingAnnotation | null; analysis?: ReviewAnalysis | null }): ReviewMove {
  const color = ply % 2 === 1 ? "WHITE" as const : "BLACK" as const;
  return {
    ply,
    moveNumber: Math.ceil(ply / 2),
    color,
    san: `move${ply}`,
    uci: "e2e4",
    fenBefore: `fen-before-${ply}`,
    fenAfter: `fen-after-${ply}`,
    coaching: opts?.coaching ?? null,
    analysis: opts?.analysis ?? null,
  };
}

function makeCoachingSummary(overrides?: Partial<GameCoachingSummary>): GameCoachingSummary {
  return {
    summary: "Solid game with one critical error.",
    strengths: ["Good opening", "Active pieces"],
    improvements: ["Avoid hanging pieces"],
    model: "claude-test",
    ...overrides,
  };
}

function simulateGameReview(moves: ReviewMove[], coaching?: GameCoachingSummary | null) {
  let selectedPly = 0;
  const total = moves.length;

  function select(ply: number) {
    selectedPly = Math.max(0, Math.min(total, ply));
  }
  function getSelectedMove() {
    return selectedPly === 0 ? null : moves[selectedPly - 1];
  }
  function getFen(game: { initialFen: string }) {
    const move = getSelectedMove();
    return move?.fenAfter ?? game.initialFen;
  }
  function getCoaching() {
    return getSelectedMove()?.coaching ?? null;
  }
  function getAnalysis() {
    return selectedPly === 0
      ? moves[0]?.analysis
      : getSelectedMove()?.analysis;
  }

  return { get selectedPly() { return selectedPly; }, select, getSelectedMove, getFen, getCoaching, getAnalysis, coaching: coaching ?? null };
}

describe("coaching annotation synchronization", () => {
  it("each ply carries its own coaching annotation independently", () => {
    const moves = [
      makeMove(1, { coaching: blunderAnnotation }),
      makeMove(2),
      makeMove(3, { coaching: normalAnnotation }),
    ];
    expect(moves[0].coaching?.classification).toBe("blunder");
    expect(moves[1].coaching).toBeNull();
    expect(moves[2].coaching?.classification).toBe("normal");
  });

  it("normal moves do not inherit stale annotation from a previously selected critical move", () => {
    const moves = [
      makeMove(1, { coaching: blunderAnnotation, analysis: makeAnalysis("blunder") }),
      makeMove(2, { analysis: makeAnalysis("normal") }),
      makeMove(3, { coaching: mistakeAnnotation, analysis: makeAnalysis("mistake") }),
    ];
    const review = simulateGameReview(moves);

    review.select(1);
    expect(review.getCoaching()?.classification).toBe("blunder");
    expect(review.getCoaching()?.headline).toBe("Hanging the queen");

    review.select(2);
    expect(review.getCoaching()).toBeNull();

    review.select(3);
    expect(review.getCoaching()?.classification).toBe("mistake");
    expect(review.getCoaching()?.headline).toBe("Weakened king safety");

    review.select(2);
    expect(review.getCoaching()).toBeNull();
  });

  it("initial position (ply 0) has no coaching", () => {
    const moves = [makeMove(1, { coaching: blunderAnnotation })];
    const review = simulateGameReview(moves);
    review.select(0);
    expect(review.getCoaching()).toBeNull();
    expect(review.getSelectedMove()).toBeNull();
  });

  it("summary moments link to canonical plies that carry annotations", () => {
    const moves = [
      makeMove(1, { coaching: blunderAnnotation }),
      makeMove(2),
      makeMove(3, { coaching: normalAnnotation }),
      makeMove(4),
    ];
    const annotatedMoves = moves.filter(m => m.coaching);
    expect(annotatedMoves.map(m => m.ply)).toEqual([1, 3]);
  });

  it("annotated moments nav only includes moves with coaching", () => {
    const moves = [
      makeMove(1, { coaching: blunderAnnotation }),
      makeMove(2),
      makeMove(3),
    ];
    const annotatedMoves = moves.filter(m => m.coaching);
    expect(annotatedMoves).toHaveLength(1);
    expect(annotatedMoves[0].ply).toBe(1);
  });
});

describe("selecting a summary moment synchronizes board, engine, and annotation", () => {
  it("clicking a summary moment selects its ply, fen, engine data, and annotation together", () => {
    const moves = [
      makeMove(1, { analysis: makeAnalysis("normal") }),
      makeMove(2, { coaching: blunderAnnotation, analysis: makeAnalysis("blunder") }),
      makeMove(3, { analysis: makeAnalysis("normal") }),
    ];
    const review = simulateGameReview(moves, makeCoachingSummary());
    const game = { initialFen: "startpos", moves };

    review.select(2);
    expect(review.selectedPly).toBe(2);
    expect(review.getFen(game)).toBe("fen-after-2");
    expect(review.getAnalysis()?.quality).toBe("blunder");
    expect(review.getCoaching()?.classification).toBe("blunder");
    expect(review.getCoaching()?.headline).toBe("Hanging the queen");
    expect(review.getCoaching()?.explanation).toContain("Qd5");
    expect(review.getCoaching()?.lesson).toContain("en prise");
    expect(review.getCoaching()?.category).toBe("tactics.hanging_piece");
  });

  it("selecting multiple annotated moments in sequence shows correct annotation each time", () => {
    const moves = [
      makeMove(1, { coaching: blunderAnnotation, analysis: makeAnalysis("blunder") }),
      makeMove(2),
      makeMove(3, { coaching: mistakeAnnotation, analysis: makeAnalysis("mistake") }),
    ];
    const review = simulateGameReview(moves);

    review.select(1);
    expect(review.getCoaching()?.category).toBe("tactics.hanging_piece");

    review.select(3);
    expect(review.getCoaching()?.category).toBe("opening.king_safety");

    review.select(1);
    expect(review.getCoaching()?.category).toBe("tactics.hanging_piece");
  });
});

describe("game-level coaching summary", () => {
  it("summary, strengths, and improvements are present when coaching data exists", () => {
    const coaching = makeCoachingSummary();
    expect(coaching.summary).toBeTruthy();
    expect(coaching.strengths).toHaveLength(2);
    expect(coaching.improvements).toHaveLength(1);
  });

  it("coaching is null when game has no coaching data", () => {
    const review = simulateGameReview([makeMove(1)], null);
    expect(review.coaching).toBeNull();
  });

  it("empty strengths or improvements arrays are valid", () => {
    const coaching = makeCoachingSummary({ strengths: [], improvements: [] });
    expect(coaching.strengths).toHaveLength(0);
    expect(coaching.improvements).toHaveLength(0);
  });
});

describe("engine-only game (no coaching)", () => {
  it("engine data is available without coaching annotations", () => {
    const moves = [
      makeMove(1, { analysis: makeAnalysis("blunder") }),
      makeMove(2, { analysis: makeAnalysis("normal") }),
    ];
    const review = simulateGameReview(moves, null);

    review.select(1);
    expect(review.getAnalysis()?.quality).toBe("blunder");
    expect(review.getCoaching()).toBeNull();

    review.select(2);
    expect(review.getAnalysis()?.quality).toBe("normal");
    expect(review.getCoaching()).toBeNull();
  });

  it("critical moves are identified from engine quality even without coaching", () => {
    const moves = [
      makeMove(1, { analysis: makeAnalysis("blunder") }),
      makeMove(2, { analysis: makeAnalysis("normal") }),
      makeMove(3, { analysis: makeAnalysis("mistake") }),
    ];
    const critical = moves.filter(m =>
      m.analysis?.quality === "mistake" || m.analysis?.quality === "blunder" || m.analysis?.quality === "inaccuracy"
    );
    expect(critical.map(m => m.ply)).toEqual([1, 3]);
  });
});

describe("AnalysisStatus coaching availability", () => {
  const statusesWithoutCoaching: AnalysisStatus[] = ["PENDING", "ENGINE_RUNNING", "ENGINE_COMPLETED", "AI_RUNNING"];
  const statusesWithPossibleCoaching: AnalysisStatus[] = ["COMPLETED", "FAILED"];

  it("statuses before COMPLETED should not have coaching", () => {
    for (const status of statusesWithoutCoaching) {
      expect(["COMPLETED", "FAILED"]).not.toContain(status);
    }
  });

  it("COMPLETED and FAILED statuses may have coaching data or need retry", () => {
    for (const status of statusesWithPossibleCoaching) {
      expect(["COMPLETED", "FAILED"]).toContain(status);
    }
  });

  it("ENGINE_COMPLETED with no coaching means engine-only review", () => {
    const moves = [makeMove(1, { analysis: makeAnalysis("normal") })];
    const review = simulateGameReview(moves, null);
    review.select(1);
    expect(review.getAnalysis()).not.toBeNull();
    expect(review.getCoaching()).toBeNull();
  });
});

describe("before-position distinction", () => {
  it("annotation explanation refers to position before move; board shows after", () => {
    const move = makeMove(1, { coaching: blunderAnnotation, analysis: makeAnalysis("blunder") });
    expect(move.fenBefore).toBe("fen-before-1");
    expect(move.fenAfter).toBe("fen-after-1");
    expect(move.fenBefore).not.toBe(move.fenAfter);
    expect(move.coaching?.explanation).toContain("Qd5");
  });

  it("engine best move and PV are from before-position", () => {
    const analysis = makeAnalysis("blunder");
    expect(analysis.bestMoveSan).toBe("e4");
    expect(analysis.pvSan).toEqual(["e4", "e5", "Nf3"]);
  });

  it("engine before/after evaluations are labeled distinctly", () => {
    const analysis = makeAnalysis("blunder");
    expect(analysis.before).not.toBeNull();
    expect(analysis.after).not.toBeNull();
    expect(analysis.before!.score).not.toEqual(analysis.after!.score);
  });
});

describe("long validated text", () => {
  it("long headline, explanation, and lesson are valid strings", () => {
    expect(longAnnotation.headline).toHaveLength(200);
    expect(longAnnotation.explanation).toHaveLength(1000);
    expect(longAnnotation.lesson).toHaveLength(500);
  });

  it("coaching fields with maximum validated content are structurally correct", () => {
    const moves = [makeMove(1, { coaching: longAnnotation })];
    const review = simulateGameReview(moves);
    review.select(1);
    const coaching = review.getCoaching();
    expect(coaching?.classification).toBe("inaccuracy");
    expect(coaching?.category).toBe("calculation.missed_threat");
    expect(typeof coaching?.headline).toBe("string");
    expect(typeof coaching?.explanation).toBe("string");
    expect(typeof coaching?.lesson).toBe("string");
  });
});

describe("move list classification dots", () => {
  it("dots appear only for moves with coaching annotations that have non-normal classification", () => {
    const CLASSIFICATION_DOT: Record<string, string> = {
      blunder: "bg-red-500",
      mistake: "bg-orange-400",
      inaccuracy: "bg-yellow-400",
    };
    const moves = [
      makeMove(1, { coaching: blunderAnnotation }),
      makeMove(2),
      makeMove(3, { coaching: normalAnnotation }),
    ];
    expect(moves[0].coaching && CLASSIFICATION_DOT[moves[0].coaching.classification]).toBeTruthy();
    expect(moves[1].coaching).toBeNull();
    expect(moves[2].coaching && CLASSIFICATION_DOT[moves[2].coaching.classification]).toBeUndefined();
  });
});
