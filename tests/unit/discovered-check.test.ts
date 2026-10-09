import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/discovered-check.json";
import examples from "../../data/learning/discovered-check-lesson.json";
import { contentSchema, validateContent } from "../../lib/learning/content";

function verifyLine(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) {
    // chess.js can accept incorrect check suffixes, so compare canonical SAN too.
    expect(board.move(san, { strict: true }).san).toBe(san);
  }
  return board;
}

describe("Discovered check book import", () => {
  it("covers all 24 source exercises in order with inspected PDF references", () => {
    expect(exercises.map(row => Number(row.number))).toEqual(Array.from({ length: 24 }, (_, i) => 277 + i));
    for (const row of exercises) {
      expect(row.order).toBe(Number(row.number));
      expect(row.content.diagramPage).toBe(String(40 + Math.floor((Number(row.number) - 277) / 12)));
      expect(row.content.pdfPage).toBe(34 + Math.floor((Number(row.number) - 277) / 12));
      expect(row.content.answerPage).toBe(Number(row.number) <= 279 ? "128" : "129");
    }
  });

  it.each(exercises)("validates $number, including full book lines and exact check suffixes", row => {
    const content = contentSchema.parse(row.content);
    const validation = validateContent(content);
    expect(validation.method).toBe("legal-authored-sequence-v1");
    expect(validation.acceptedMoves).toHaveLength(1);
    verifyLine(content.fen, content.solutionText);
    for (const line of row.bookLines) {
      const board = verifyLine(content.fen, line);
      if (line.endsWith("#")) expect(board.isCheckmate()).toBe(true);
      expect(content.explanation).toContain(line);
    }
  });

  it("preserves longer continuations without exceeding the practice limit", () => {
    const longer = exercises.filter(row => row.bookLines[0].split(" ").length > 7);
    expect(longer.map(row => row.number)).toEqual(["282", "289"]);
    for (const row of longer) {
      expect(row.content.solutionText).toBe(row.bookLines[0].split(" ").slice(0, 7).join(" "));
      expect(row.content.explanation).toContain("Practice ends after White’s fourth move");
    }
  });

  it.each(examples)("verifies the teaching example: $title", example => {
    verifyLine(example.fen, example.demonstration);
  });

});
