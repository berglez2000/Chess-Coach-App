import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/mixed-motifs-black.json";
import { validateContent } from "../../lib/learning/content";

function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  return board;
}
const byNumber = (number: number) => exercises.find(row => row.order === number)!;

describe("Mixed motifs: Black chapter", () => {
  it("covers all 174 diagrams with Black to move and source page references", () => {
    expect(exercises.map(row => row.order)).toEqual(Array.from({ length: 174 }, (_, i) => 691 + i));
    for (const row of exercises) {
      const page = row.order < 697 ? 93 : 94 + Math.floor((row.order - 697) / 12);
      expect(row.number).toBe(String(row.order));
      expect(row.content.solver).toBe("BLACK");
      expect(new Chess(row.content.fen).turn()).toBe("b");
      expect(row.content.diagramPage).toBe(String(page));
      expect(row.content.pdfPage).toBe(page - 10);
      expect(row.content.answerPage).toBe(row.order === 785 ? "138–139" : row.order === 826 ? "139–140" : String(row.order <= 744 ? 137 : row.order <= 785 ? 138 : row.order <= 826 ? 139 : 140));
    }
  });

  it.each(exercises)("validates $number and every full source continuation", row => {
    const validation = validateContent(row.content);
    expect(validation.method).toBe("legal-authored-sequence-v1");
    const moves = row.bookLines[0].split(" ");
    const length = Math.min(7, moves.length % 2 ? moves.length : moves.length - 1);
    expect(row.content.solutionText).toBe(moves.slice(0, length).join(" "));
    for (const line of [...row.bookLines, ...("analysisLines" in row ? row.analysisLines ?? [] : [])]) replay(row.content.fen, line);
  });

  it.each([698, 701, 737, 748, 764, 851])("reaches the source stalemate in %i", number => {
    const row = byNumber(number);
    expect(replay(row.content.fen, row.bookLines[0]).isStalemate()).toBe(true);
  });

  it.each([700, 740, 744, 799, 845, 846, 850])("retains the checking loop in %i", number => {
    const row = byNumber(number);
    expect(row.content.prompt).toContain("drawing");
    expect(replay(row.content.fen, row.bookLines[0]).isCheck()).toBe(true);
  });

  it("preserves promotion with check and the two-rook mating sequence", () => {
    const promotion = byNumber(782);
    expect(replay(promotion.content.fen, "f5+ Kxh3 f1=Q+").get("f1")).toMatchObject({ type: "q", color: "b" });
    const rooks = byNumber(849);
    expect(rooks.bookLines[0]).toContain("R8e2+");
    expect(replay(rooks.content.fen, rooks.bookLines[0]).isCheckmate()).toBe(true);
  });

  it("keeps the exercise 820 source error separate from its valid mating answer", () => {
    const row = byNumber(820);
    expect(replay(row.content.fen, row.bookLines[0]).isCheckmate()).toBe(true);
    const sideline = "Qe2 Rc1 Rxg2+ Kh1 Rxh2+ Kg1 Qg2+";
    expect(row.analysisLines).toContain(sideline);
    const board = replay(row.content.fen, sideline);
    expect(board.isCheckmate()).toBe(false);
    expect(board.move("Qxg2", { strict: true }).captured).toBe("q");
  });
});
