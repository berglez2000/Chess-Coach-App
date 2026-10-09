import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/discovered-attack.json";
import examples from "../../data/learning/discovered-attack-lesson.json";
import { contentSchema, validateContent } from "../../lib/learning/content";

function verifyLine(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) {
    // chess.js can accept incorrect check suffixes, so compare canonical SAN too.
    expect(board.move(san, { strict: true }).san).toBe(san);
  }
  return board;
}

describe("Discovered attack book import", () => {
  it("covers all 24 source exercises in order with inspected PDF references", () => {
    expect(exercises.map(row => Number(row.number))).toEqual(Array.from({ length: 24 }, (_, i) => 253 + i));
    for (const row of exercises) {
      expect(row.order).toBe(Number(row.number));
      expect(row.content.diagramPage).toBe(String(36 + Math.floor((Number(row.number) - 253) / 12)));
      expect(row.content.pdfPage).toBe(31 + Math.floor((Number(row.number) - 253) / 12));
      expect(row.content.answerPage).toBe("128");
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
    expect(longer.map(row => row.number)).toEqual(["265", "268"]);
    for (const row of longer) {
      expect(row.content.solutionText).toBe(row.bookLines[0].split(" ").slice(0, 7).join(" "));
      expect(row.content.explanation).toContain("Practice ends after White’s fourth move");
    }
  });

  it.each(examples)("verifies the teaching example: $title", example => {
    verifyLine(example.fen, example.demonstration);
  });

  it("verifies the book’s caution against an immediate bishop move in 269", () => {
    const row = exercises.find(row => row.number === "269")!;
    verifyLine(row.content.fen, "Bh6 Rxd1+ Ke2 Ng7 Kxd1 e5");
  });
});
