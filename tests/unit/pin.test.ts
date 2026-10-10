import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/pin.json";
import examples from "../../data/learning/pin-lesson.json";
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

describe("Pin chapter", () => {
  it("covers all 36 source exercises with PDF provenance", () => {
    expect(exercises.map(row => Number(row.number))).toEqual(Array.from({ length: 36 }, (_, i) => 325 + i));
    for (const row of exercises) {
      expect(row.order).toBe(Number(row.number));
      expect(row.content.diagramPage).toBe(String(49 + Math.floor((row.order - 325) / 12)));
      expect(row.content.pdfPage).toBe(41 + Math.floor((row.order - 325) / 12));
      expect(row.content.answerPage).toBe(row.order <= 337 ? "129" : "130");
    }
  });
  it.each(exercises)("validates $number and every complete book variation", row => {
    expect(validateContent(contentSchema.parse(row.content)).method).toBe("legal-authored-sequence-v1");
    expect(row.content.solutionText).toBe(row.bookLines[0].split(" ").slice(0, 7).join(" "));
    for (const line of row.bookLines) {
      replay(row.content.fen, line);
      expect(row.content.explanation).toContain(line);
    }
  });
  it.each(examples)("validates teaching example: $title", example => {
    replay(example.fen, example.demonstration);
  });
  it("retains continuations beyond the trainer bound", () => {
    expect(exercises.filter(row => row.bookLines[0].split(" ").length > 7).map(row => row.number)).toEqual(["341", "354", "356"]);
    for (const row of exercises.filter(row => row.bookLines[0].split(" ").length > 7)) expect(row.content.explanation).toContain("Practice ends after White’s fourth move");
  });
  it("forbids en passant when it exposes the king in 328", () => {
    const board = position(328);
    board.move("b4#");
    expect(board.moves({ verbose: true }).some(move => move.from === "a4" && move.to === "b3")).toBe(false);
    expect(board.isCheckmate()).toBe(true);
  });
  it("keeps the absolute queen pin and relative pawn pin in 336", () => {
    const board = position(336);
    board.move("Rb1");
    expect(board.moves()).not.toContain("Qxb1");
    board.move("Qxc5");
    expect(board.moves()).toContain("Rxb7#");
  });
  it("allows the relative pin to be broken in 348", () => {
    const board = position(348);
    expect(board.moves()).toContain("Nxd4");
    replay(board.fen(), exercises.find(row => row.number === "348")!.bookLines[0]);
  });
});
