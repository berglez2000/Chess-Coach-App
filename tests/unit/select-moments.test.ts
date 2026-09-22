import { expect, it } from "vitest";
import { selectMoments, type MomentInput } from "@/lib/coaching/select-moments";
import { parsePgn } from "@/lib/pgn/parse";
import type { MoveAssessment } from "@/types/analysis";
const pgn = Array.from({ length: 32 }, (_, i) => `${i + 1}. ${i % 2 ? "Ng1 Ng8" : "Nf3 Nf6"}`).join(" ") + " *";
const moves = parsePgn(pgn).moves;
function assessment(ply: number, loss = 100): { ply: number; assessment: MoveAssessment } {
  const move = moves[ply - 1];
  const sign = move.color === "WHITE" ? 1 : -1;
  return { ply, assessment: {
    policyVersion: 1, quality: loss >= 100 ? "blunder" : loss >= 50 ? "mistake" : loss >= 20 ? "inaccuracy" : "normal",
    reason: "cp_loss", cpLoss: loss, rawCpLoss: loss,
    facts: { fenBefore: move.fenBefore, fenAfter: move.fenAfter, move: move.uci, mover: move.color,
      legalMoveCount: 20, bestMove: null, terminal: null,
      before: { perspective: "WHITE", depth: 12, pv: [], score: { kind: "cp", value: 0, bound: "exact" } },
      after: { perspective: "WHITE", depth: 12, pv: [], score: { kind: "cp", value: -sign * loss, bound: "exact" } },
    },
  } };
}
function input(assessments: MomentInput["assessments"], userColor: MomentInput["userColor"] = "WHITE", limit = 8): MomentInput {
  return { moves, userColor, assessments, limit };
}
function positive(ply: number) {
  const item = assessment(ply, 0);
  item.assessment.reason = "mate_found";
  item.assessment.cpLoss = null;
  item.assessment.rawCpLoss = null;
  item.assessment.facts.after!.score = { kind: "mate", value: moves[ply - 1].color === "WHITE" ? 3 : -3, winner: moves[ply - 1].color, bound: "exact" };
  return item;
}
it.each(["WHITE", "BLACK"] as const)("prioritizes %s losses over larger opponent mistakes", userColor => {
  const own = userColor === "WHITE" ? 1 : 2;
  const other = userColor === "WHITE" ? 6 : 5;
  const selected = selectMoments(input([assessment(other, 500), assessment(own, 100)], userColor, 1));
  expect(selected.map(item => item.ply)).toEqual([own]);
  expect(selected[0].kind).toBe("user_loss");
});
it("ranks larger losses, breaks ties by ply, and ignores input ordering", () => {
  const items = [assessment(1, 100), assessment(5, 200), assessment(9, 200)];
  expect(selectMoments(input(items, "WHITE", 1)).map(item => item.ply)).toEqual([5]);
  expect(selectMoments(input([...items].reverse(), "WHITE", 1))).toEqual(selectMoments(input(items, "WHITE", 1)));
});
it("suppresses adjacent moves from a short sequence without padding", () => {
  const selected = selectMoments(input([assessment(1, 100), assessment(2, 200), assessment(3, 300), assessment(7, 50)]));
  expect(selected.map(item => item.ply)).toEqual([3, 7]);
});
it("returns nothing for quiet/unknown games and never pads short games", () => {
  const quiet = assessment(1, 10);
  const unknown = assessment(5); unknown.assessment.quality = "unknown";
  expect(selectMoments(input([quiet, unknown]))).toEqual([]);
  expect(selectMoments(input([]))).toEqual([]);
  expect(selectMoments(input([assessment(1)]))).toHaveLength(1);
});
it("excludes unknown, duplicated, and mismatched plies", () => {
  const invalid = assessment(5); invalid.assessment.facts.move = "a1a8";
  expect(selectMoments(input([assessment(1), assessment(1), invalid, { ...assessment(9), ply: 999 }]))).toEqual([]);
  const duplicatedMoves = { ...input([assessment(1)]), moves: [...moves, moves[0]] };
  expect(selectMoments(duplicatedMoves)).toEqual([]);
});
it("caps selection and reserves positive and opponent evidence when separated", () => {
  const items = [1, 5, 9, 13, 17, 21, 25, 29, 33, 37].map(ply => assessment(ply, 100 + ply));
  items.push(positive(45), assessment(50, 200));
  const selected = selectMoments(input(items));
  expect(selected).toHaveLength(8);
  expect(selected.some(item => item.kind === "positive" && item.evidence[0].code === "mate_found")).toBe(true);
  expect(selected.some(item => item.kind === "opponent_context")).toBe(true);
  expect(new Set(selected.map(item => item.ply)).size).toBe(8);
  expect(JSON.stringify(selected)).not.toMatch(/brilliant|difficult|tactic/);
});
it("does not invent positive highlights from low loss or a best-move match", () => {
  const item = assessment(1, 0); item.assessment.facts.bestMove = item.assessment.facts.move;
  expect(selectMoments(input([item]))).toEqual([]);
  expect(selectMoments(input([positive(2)]))).toEqual([]);
});
it("retains distinct mate and advantage-change evidence without fake cp values", () => {
  const mate = assessment(1); mate.assessment.reason = "mate_missed"; mate.assessment.cpLoss = null;
  mate.assessment.facts.before!.score = { kind: "mate", value: 3, winner: "WHITE", bound: "exact" };
  const swing = assessment(5, 300);
  swing.assessment.facts.before!.score.value = 150;
  swing.assessment.facts.after!.score.value = -150;
  const selected = selectMoments(input([mate, swing]));
  expect(selected[0].evidence[0]).toMatchObject({ code: "mate_missed", cpLoss: null });
  expect(selected[1].evidence.map(item => item.code)).toEqual(["evaluation_loss", "advantage_reversed"]);
});
it("excludes shallow, bounded, forced and overwhelming-position signals", () => {
  const shallow = assessment(1); shallow.assessment.facts.before!.depth = 7;
  const bounded = assessment(5); bounded.assessment.facts.after!.score.bound = "lower";
  const forced = assessment(9); forced.assessment.facts.legalMoveCount = 1;
  const overwhelming = assessment(13); overwhelming.assessment.reason = "overwhelming_position";
  expect(selectMoments(input([shallow, bounded, forced, overwhelming]))).toEqual([]);
});
it("accepts terminal checkmate evidence without pretending it is a deep search", () => {
  const item = positive(1); item.assessment.reason = "checkmate"; item.assessment.facts.terminal = "checkmate";
  item.assessment.facts.after!.depth = 0;
  item.assessment.facts.after!.score.value = 0;
  expect(selectMoments(input([item]))[0].evidence[0].code).toBe("checkmate_delivered");
});
it.each([0, 11, 1.5])("rejects invalid selection caps (%#)", limit => {
  expect(() => selectMoments(input([], "WHITE", limit))).toThrow();
});
