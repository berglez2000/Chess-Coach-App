import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/decoy-sacrifice.json";
import examples from "../../data/learning/decoy-sacrifice-lesson.json";
import { validateContent } from "../../lib/learning/content";

function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  if (line.endsWith("#")) expect(board.isCheckmate()).toBe(true);
  return board;
}

describe("Decoy sacrifice chapter", () => {
  it("covers all source diagrams in order with page references", () => {
    expect(exercises.map(row => Number(row.number))).toEqual(Array.from({ length: 24 }, (_, i) => 409 + i));
    for (const row of exercises) {
      expect(row.order).toBe(Number(row.number));
      expect(row.content.diagramPage).toBe(String(61 + Math.floor((row.order - 409) / 12)));
      expect(row.content.pdfPage).toBe(51 + Math.floor((row.order - 409) / 12));
      expect(row.content.answerPage).toBe(row.order === 409 ? "131" : "132");
    }
  });
  it.each(exercises)("validates $number, including complete source variations", row => {
    expect(validateContent(row.content).method).toBe("legal-authored-sequence-v1");
    expect(row.content.solutionText).toBe(row.bookLines[0].split(" ").slice(0, 7).join(" "));
    for (const line of row.bookLines) replay(row.content.fen, line);
  });
  it.each(examples)("replays teaching example: $title", example => {
    replay(example.fen, example.demonstration);
    for (const line of example.bookLines ?? []) replay(example.fen, line);
  });
  it("retains Lasker's full king hunt and castling mate beyond the practice boundary", () => {
    const row = exercises.find(row => row.number === "430")!;
    expect(replay(row.content.fen, row.content.solutionText).isCheckmate()).toBe(false);
    const board = replay(row.content.fen, row.bookLines[0]);
    expect(board.isCheckmate()).toBe(true);
    expect(board.get("c1")).toMatchObject({ type: "k", color: "w" });
  });
  it("distinguishes the back rank check from the ensuing mate in 418", () => {
    const row = exercises.find(row => row.number === "418")!;
    const board = replay(row.content.fen, row.bookLines[0]);
    expect(board.isCheckmate()).toBe(false);
    expect(board.moves()).toEqual(["Nf8"]);
    board.move("Nf8");
    expect(board.move("Rxf8#").san).toBe("Rxf8#");
  });
});
