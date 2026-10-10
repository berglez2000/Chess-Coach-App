import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/skewer.json";
import examples from "../../data/learning/skewer-lesson.json";
import { contentSchema, validateContent } from "../../lib/learning/content";

function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  if (line.endsWith("#")) expect(board.isCheckmate()).toBe(true);
  return board;
}
function position(number: number) {
  return new Chess(exercises.find(row => row.number === String(number))!.content.fen);
}

describe("Skewer chapter", () => {
  it("covers all 24 exercises with source references", () => {
    expect(exercises.map(row => Number(row.number))).toEqual(Array.from({ length: 24 }, (_, i) => 361 + i));
    for (const row of exercises) {
      expect(row.order).toBe(Number(row.number));
      expect(row.content.diagramPage).toBe(String(54 + Math.floor((row.order - 361) / 12)));
      expect(row.content.pdfPage).toBe(45 + Math.floor((row.order - 361) / 12));
      expect(row.content.answerPage).toBe("130");
    }
  });
  it.each(exercises)("validates $number and every complete source variation", row => {
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
  });
  it("retains both long queen endgames beyond the trainer bound", () => {
    expect(exercises.filter(row => row.bookLines[0].split(" ").length > 7).map(row => row.number)).toEqual(["380", "381"]);
    for (const row of exercises.filter(row => row.bookLines[0].split(" ").length > 7)) expect(row.content.explanation).toContain("Practice ends after White’s fourth move");
  });
  it("requires unpinning before promotion in 372", () => {
    const board = position(372);
    expect(board.moves()).not.toContain("g8=Q+");
    board.move("Qc4+"); board.move("Qxc4");
    expect(board.moves()).toContain("g8=Q+");
    board.move("g8=Q+");
    expect(board.isCheck()).toBe(true);
    expect(board.get("c4")?.type).toBe("q");
  });
  it("pins the knight that could otherwise capture Be4 in 366", () => {
    const board = position(366);
    board.move("Be4");
    expect(board.moves()).not.toContain("Nxe4");
    expect(board.get("d6")?.type).toBe("n");
  });
  it("demonstrates the mating reply after a tempting rook capture", () => {
    const board = replay(examples[1].fen, examples[1].demonstration);
    expect(board.isCheckmate()).toBe(true);
    expect(examples[1].fen.split(" ")[1]).toBe("b");
  });
});
