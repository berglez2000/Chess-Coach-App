import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/double-attack.json";
import { contentSchema, validateContent } from "../../lib/learning/content";

describe("Double attack book import", () => {
  it("covers exercises 217–252 in source order with verified source links", () => {
    expect(exercises.map(row => Number(row.number))).toEqual(Array.from({ length: 36 }, (_, i) => 217 + i));
    for (const row of exercises) {
      expect(row.order).toBe(Number(row.number));
      expect(row.content.pdfPage).toBe(27 + Math.floor((Number(row.number) - 217) / 12));
      expect(row.content.answerPage).toBe(Number(row.number) <= 234 ? "127" : "128");
    }
  });

  it.each(exercises)("validates $number and its additional book variations", row => {
    const content = contentSchema.parse(row.content);
    const validation = validateContent(content);
    expect(validation.method).toBe("legal-authored-sequence-v1");
    expect(validation.acceptedMoves).toHaveLength(1);
    for (const line of "bookVariations" in row ? row.bookVariations ?? [] : []) {
      expect(() => validateContent({ ...content, solutionText: line })).not.toThrow();
      expect(content.explanation).toContain(line);
    }
  });

  it("matches the supplied corrections for 238 and 241", () => {
    const fork = exercises.find(row => row.number === "238")!;
    const board = new Chess(fork.content.fen);
    for (const san of ["Re6", "Qh4", "Qc7#"]) board.move(san);
    expect(board.isCheckmate()).toBe(true);
    expect(fork.content.explanation).toContain("Qc7 mate");
    const backRank = exercises.find(row => row.number === "241")!;
    const reply = new Chess(backRank.content.fen);
    for (const san of ["Qb4", "Qxb4", "Re8+"]) reply.move(san);
    expect(reply.isCheck()).toBe(true);
    expect(reply.isCheckmate()).toBe(false);
    expect(backRank.bookVariations).toEqual(["Qb4 Qxb4 Re8+"]);
  });

  it("preserves exercise 228’s longer book sideline as a verified explanation", () => {
    const row = exercises.find(row => row.number === "228")!;
    const board = new Chess(row.content.fen);
    for (const san of ["Re8+", "Bf8", "Rxf8+", "Kxf8", "Nf5+", "Kg8", "Qf8+", "Kxf8", "Rd8#"]) board.move(san, { strict: true });
    expect(board.isCheckmate()).toBe(true);
    expect(row.content.explanation).toContain("Rd8 mate");
  });
});
