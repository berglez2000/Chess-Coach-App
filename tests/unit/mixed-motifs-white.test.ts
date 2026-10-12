import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/mixed-motifs-white.json";
import { validateContent } from "../../lib/learning/content";

function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  return board;
}

describe("Mixed motifs: White chapter", () => {
  it("covers all 198 diagrams with book and PDF provenance", () => {
    expect(exercises.map(row => row.order)).toEqual(Array.from({ length: 198 }, (_, i) => 493 + i));
    for (const row of exercises) {
      const page = row.order < 499 ? 75 : 76 + Math.floor((row.order - 499) / 12);
      expect(row.number).toBe(String(row.order));
      expect(row.content.diagramPage).toBe(String(page));
      expect(row.content.pdfPage).toBe(page - 10);
      expect(row.content.answerPage).toBe(String(row.order <= 517 ? 133 : row.order <= 575 ? 134 : row.order <= 625 ? 135 : row.order <= 682 ? 136 : 137));
    }
  });

  it.each(exercises)("validates $number and all full source continuations", row => {
    expect(validateContent(row.content).method).toBe("legal-authored-sequence-v1");
    const moves = row.bookLines[0].split(" ");
    const length = Math.min(7, moves.length % 2 ? moves.length : moves.length - 1);
    expect(row.content.solutionText).toBe(moves.slice(0, length).join(" "));
    for (const line of row.bookLines) replay(row.content.fen, line);
  });

  it("retains queenside castling, knight and rook underpromotions, and stalemate outcomes", () => {
    const byNumber = (number: number) => exercises.find(row => row.order === number)!;
    expect(replay(byNumber(639).content.fen, "O-O-O").get("d1")).toMatchObject({ type: "r", color: "w" });
    for (const [number, square, type] of [[531, "c8", "n"], [587, "e8", "n"], [589, "f8", "n"], [675, "h8", "r"]] as const) {
      const row = byNumber(number);
      expect(replay(row.content.fen, row.bookLines[0].split(" ").slice(0, number === 531 || number === 589 ? 5 : number === 587 ? 3 : 1).join(" ")).get(square)).toMatchObject({ type, color: "w" });
    }
    expect(replay(byNumber(637).content.fen, byNumber(637).bookLines[0]).isStalemate()).toBe(true);
    expect(replay(byNumber(675).content.fen, "h8=Q Rd8+ Qxd8").isStalemate()).toBe(true);
  });
});
