import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/drawing-tactics.json";
import examples from "../../data/learning/drawing-tactics-lesson.json";
import { validateContent } from "../../lib/learning/content";
function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  return board;
}
const perpetual = [476, 477, 488];
describe("Drawing tactics chapter", () => {
  it("covers all 24 source diagrams with page references", () => {
    expect(exercises.map(row => row.order)).toEqual(Array.from({ length: 24 }, (_, i) => 469 + i));
    for (const row of exercises) {
      expect(row.number).toBe(String(row.order));
      expect(row.content.diagramPage).toBe(String(72 + Math.floor((row.order - 469) / 12)));
      expect(row.content.pdfPage).toBe(62 + Math.floor((row.order - 469) / 12));
      expect(row.content.answerPage).toBe("133");
    }
  });
  it.each(exercises)("validates $number and its full drawing outcome", row => {
    expect(validateContent(row.content).method).toBe("legal-authored-sequence-v1");
    const moves = row.bookLines[0].split(" ");
    expect(row.content.solutionText).toBe(moves.slice(0, Math.min(7, moves.length % 2 ? moves.length : moves.length - 1)).join(" "));
    for (const line of row.bookLines) replay(row.content.fen, line);
    for (const line of "analysisLines" in row ? row.analysisLines ?? [] : []) replay(row.content.fen, line);
    if (!perpetual.includes(row.order)) expect(replay(row.content.fen, row.bookLines[0]).isStalemate()).toBe(true);
  });
  it.each(exercises.filter(row => perpetual.includes(row.order)))("repeats the checking position in $number", row => {
    const board = new Chess(row.content.fen);
    const moves = row.bookLines[0].split(" ");
    for (const move of moves) board.move(move);
    expect(board.isCheck()).toBe(true);
    const repeatedPosition = board.fen().split(" ").slice(0, 4).join(" ");
    for (let i = 0; i < 2; i++) {
      for (const move of moves.slice(1)) board.move(move);
      expect(board.isCheck()).toBe(true);
      expect(board.fen().split(" ").slice(0, 4).join(" ")).toBe(repeatedPosition);
    }
    expect(board.isThreefoldRepetition()).toBe(true);
  });
  it.each(examples)("replays teaching example: $title", example => {
    replay(example.fen, example.demonstration);
    for (const line of example.bookLines ?? []) replay(example.fen, line);
  });
  it("liquidates into the wrong-bishop rook-pawn ending", () => {
    const board = replay(examples[1].fen, examples[1].demonstration);
    expect(board.get("h8")).toMatchObject({ type: "k", color: "b" });
    expect(board.get("h4")).toMatchObject({ type: "p", color: "w" });
    expect(board.get("b3")).toMatchObject({ type: "b", color: "w" });
    expect(board.squareColor("h8")).not.toBe(board.squareColor("b3"));
    expect(board.board().flat().filter(piece => piece?.type === "p")).toHaveLength(1);
  });
});
