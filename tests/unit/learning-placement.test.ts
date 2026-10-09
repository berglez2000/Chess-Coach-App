import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import rows from "@/data/learning/missing-piece.json";
import { contentSchema, validateContent, answerIdentity } from "@/lib/learning/content";
import { applyPlacementAction, placementDto, placedPosition } from "@/lib/learning/placement";
import { INITIAL_PROGRESS, puzzleActionSchema } from "@/lib/puzzles/solve";
const content = contentSchema.parse(rows[0].content);
const accepted = validateContent(content).acceptedMoves;
const action = (move: string) => ({ action: "MOVE" as const, move, requestId: randomUUID(), expectedRevision: 0 });
describe("book placements", () => {
  it("validates all 30 supplied answers and finds the alternative mate in 202", () => {
    expect(rows).toHaveLength(30);
    expect(new Set(rows.map(r => r.number)).size).toBe(30);
    for (const row of rows) {
      const c = contentSchema.parse(row.content), v = validateContent(c);
      const square = c.solutionText.match(/[a-h][1-8]/)![0];
      expect(v.acceptedMoves[0]).toBe(`${c.placementPiece}@${square}`);
      if (c.objective === "MATE") expect(placedPosition(c.fen, c.placementPiece, square, c.solver).isCheckmate()).toBe(true);
      else expect(v.method).toBe("authored-placement-v1");
    }
    expect(validateContent(rows.find(r => r.number === "202")!.content).acceptedMoves).toEqual(["r@c6", "r@e5"]);
  });
  it("does not expose answers until assistance or completion and restores the diagram on retry", () => {
    const hidden = placementDto("id", content, accepted, INITIAL_PROGRESS);
    expect(hidden).toMatchObject({ currentFen: content.fen, solution: null, solutionLine: null, hintSquare: null });
    expect(JSON.stringify(hidden)).not.toContain("g6");
    const hinted = applyPlacementAction(content, accepted, INITIAL_PROGRESS, { action: "HINT", requestId: randomUUID(), expectedRevision: 0 });
    expect(placementDto("id", content, accepted, hinted).hintSquare).toBe("g6");
    const revealed = applyPlacementAction(content, accepted, hinted, { action: "REVEAL", requestId: randomUUID(), expectedRevision: 1 });
    expect(revealed.completedAt).toBeNull();
    expect(new Chess(placementDto("id", content, accepted, revealed).currentFen).isCheckmate()).toBe(true);
    const retry = applyPlacementAction(content, accepted, revealed, { action: "RETRY", requestId: randomUUID(), expectedRevision: 2 });
    expect(placementDto("id", content, accepted, retry).currentFen).toBe(content.fen);
    const solved = applyPlacementAction(content, accepted, retry, action("n@g6"));
    expect(solved).toMatchObject({ state: "SOLVED", completionAssisted: true, playedMoves: ["n@g6"] });
    const again = applyPlacementAction(content, accepted, solved, { action: "RETRY", requestId: randomUUID(), expectedRevision: 4 });
    expect(again.completedAt).toBe(solved.completedAt);
  });
  it("rejects occupied squares, moving existing pieces, wrong pieces, and incorrect placements", () => {
    for (const move of ["n@h8", "r@g6", "h1h6"]) expect(applyPlacementAction(content, accepted, INITIAL_PROGRESS, action(move))).toMatchObject({ lastOutcome: "ILLEGAL", state: "SOLVING", moveAttempts: 1 });
    expect(applyPlacementAction(content, accepted, INITIAL_PROGRESS, action("n@e4"))).toMatchObject({ lastOutcome: "INCORRECT", playedMoves: [] });
    expect(() => placedPosition(content.fen, "p", "a8", "WHITE")).toThrow("Pawns");
    expect(() => validateContent({ ...content, solutionText: "Ne4#" })).toThrow("checkmate");
    expect(puzzleActionSchema.safeParse(action("n@g6")).success).toBe(false);
  });
  it("accepts a Black placement and protects the solver king", () => {
    const black = contentSchema.parse({ type: "MISSING_PIECE", placementPiece: "q", fen: "7k/8/8/8/8/6k1/8/7K b - - 0 1", solver: "BLACK", solutionText: "Qg2#" });
    // A position must contain exactly one king of each color.
    expect(() => validateContent(black)).toThrow("valid full FEN");
    const valid = { ...black, fen: "8/8/8/8/8/6k1/8/7K b - - 0 1" };
    expect(validateContent(valid).acceptedMoves).toContain("q@g2");
    expect(() => placedPosition("4r2k/8/8/8/8/8/8/4K3 w - - 0 1", "n", "a3", "WHITE")).toThrow("king safe");
  });
  it("includes the specified piece in answer identity", () => {
    expect(answerIdentity(content)).not.toBe(answerIdentity({ ...content, placementPiece: "b" }));
  });
});
