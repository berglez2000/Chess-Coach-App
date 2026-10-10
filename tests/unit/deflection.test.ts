import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/deflection.json";
import examples from "../../data/learning/deflection-lesson.json";
import { contentSchema, validateContent } from "../../lib/learning/content";

function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  if (line.endsWith("#")) expect(board.isCheckmate()).toBe(true);
  return board;
}
function exercise(number: number) { return exercises.find(row => row.number === String(number))!; }

describe("Deflection chapter", () => {
  it("covers all 24 source exercises with provenance", () => {
    expect(exercises.map(row => Number(row.number))).toEqual(Array.from({ length: 24 }, (_, i) => 385 + i));
    for (const row of exercises) {
      expect(row.order).toBe(Number(row.number));
      expect(row.content.diagramPage).toBe(String(58 + Math.floor((row.order - 385) / 12)));
      expect(row.content.pdfPage).toBe(48 + Math.floor((row.order - 385) / 12));
      expect(row.content.answerPage).toBe("131");
    }
  });
  it.each(exercises)("validates $number and all source continuations", row => {
    expect(validateContent(contentSchema.parse(row.content)).method).toBe("legal-authored-sequence-v1");
    expect(row.content.solutionText).toBe(row.bookLines[0].split(" ").slice(0, 7).join(" "));
    for (const line of row.bookLines) {
      replay(row.content.fen, line);
      expect(row.content.explanation).toContain(line);
    }
    for (const line of row.analysisLines ?? []) replay(row.content.fen, line);
  });
  it.each(examples)("validates teaching example: $title", example => {
    replay(example.fen, example.demonstration);
    for (const line of example.bookLines ?? []) replay(example.fen, line);
  });
  it("deflects the knight that guards the mating bishop square in 386", () => {
    const board = new Chess(exercise(386).content.fen);
    expect(board.moves()).not.toContain("Ba7#");
    board.move("Rd8+"); board.move("Nxd8");
    expect(board.moves()).toContain("Ba7#");
  });
  it("requires sacrificing the correct rook in 392", () => {
    const row = exercise(392);
    expect(replay(row.content.fen, row.bookLines[0]).isCheckmate()).toBe(true);
    const failure = replay(row.content.fen, row.analysisLines![0]);
    expect(failure.isCheckmate()).toBe(false);
    expect(failure.get("h5")?.type).toBe("k");
  });
  it("deflects the pawn defending g6 in 406", () => {
    const board = new Chess(exercise(406).content.fen);
    expect(board.moves()).not.toContain("Qg6#");
    board.move("Re6+"); board.move("fxe6");
    expect(board.moves()).toContain("Qg6#");
  });
  it("keeps the introduction's inconsistent follow-up out of playable lines", () => {
    expect(examples[1].sourceNote).toContain("already on f4");
    expect(examples[1].bookLines?.every(line => !line.includes("Qe5+"))).toBe(true);
  });
});
