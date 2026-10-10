import { describe, expect, it } from "vitest";
import { Chess, SQUARES } from "chess.js";
import exercises from "../../data/learning/double-check.json";
import examples from "../../data/learning/double-check-lesson.json";
import { contentSchema, validateContent } from "../../lib/learning/content";

function verifyLine(fen: string, line: string) {
  const board = new Chess(fen);
  let doubleChecks = 0;
  for (const san of line.split(" ")) {
    expect(board.move(san, { strict: true }).san).toBe(san);
    const king = SQUARES.find(square => board.get(square)?.type === "k" && board.get(square)?.color === board.turn())!;
    const attackers = board.attackers(king, board.turn() === "b" ? "w" : "b");
    if (attackers.length >= 2) {
      doubleChecks++;
      // Every legal defense to a double check must move the king.
      expect(board.moves({ verbose: true }).every(move => move.piece === "k")).toBe(true);
    }
  }
  return { board, doubleChecks };
}

describe("Double check book import", () => {
  it("covers exercises 301–324 with inspected source references", () => {
    expect(exercises.map(row => Number(row.number))).toEqual(Array.from({ length: 24 }, (_, i) => 301 + i));
    for (const row of exercises) {
      expect(row.order).toBe(Number(row.number));
      expect(row.content.diagramPage).toBe(String(44 + Math.floor((Number(row.number) - 301) / 12)));
      expect(row.content.pdfPage).toBe(37 + Math.floor((Number(row.number) - 301) / 12));
      expect(row.content.answerPage).toBe("129");
    }
  });

  it.each(exercises)("validates $number, exact SAN, double checks, and mating endings", row => {
    const content = contentSchema.parse(row.content);
    expect(validateContent(content).method).toBe("legal-authored-sequence-v1");
    verifyLine(content.fen, content.solutionText);
    expect(verifyLine(content.fen, row.bookLines[0]).doubleChecks).toBeGreaterThan(0);
    for (const line of row.bookLines) {
      const { board } = verifyLine(content.fen, line);
      if (line.endsWith("#")) expect(board.isCheckmate()).toBe(true);
      expect(content.explanation).toContain(line);
    }
  });

  it("retains the full continuations for exercises exceeding the practice limit", () => {
    const longer = exercises.filter(row => row.bookLines[0].split(" ").length > 7);
    expect(longer.map(row => row.number)).toEqual(["308", "313", "315"]);
    for (const row of longer) {
      expect(row.content.solutionText).toBe(row.bookLines[0].split(" ").slice(0, 7).join(" "));
      expect(row.content.explanation).toContain("Practice ends after White’s fourth move");
    }
  });

  it.each(examples)("checks the teaching demonstration: $title", example => {
    const { board, doubleChecks } = verifyLine(example.fen, example.demonstration);
    expect(board.isCheckmate()).toBe(true);
    expect(doubleChecks).toBeGreaterThan(0);
  });
});
