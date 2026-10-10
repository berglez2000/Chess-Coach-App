import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/promotion.json";
import examples from "../../data/learning/promotion-lesson.json";
import { validateContent } from "../../lib/learning/content";
function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  if (line.endsWith("#")) expect(board.isCheckmate()).toBe(true);
  return board;
}
const exercise = (number: number) => exercises.find(row => row.order === number)!;
describe("Promotion chapter", () => {
  it("covers all 36 diagrams with their source pages", () => {
    expect(exercises.map(row => row.order)).toEqual(Array.from({ length: 36 }, (_, i) => 433 + i));
    for (const row of exercises) {
      expect(row.number).toBe(String(row.order));
      expect(row.content.diagramPage).toBe(String(65 + Math.floor((row.order - 433) / 12)));
      expect(row.content.pdfPage).toBe(55 + Math.floor((row.order - 433) / 12));
      expect(row.content.answerPage).toBe("132");
    }
  });
  it.each(exercises)("validates $number and all complete continuations", row => {
    expect(validateContent(row.content).method).toBe("legal-authored-sequence-v1");
    expect(row.content.solutionText).toBe(row.bookLines[0].split(" ").slice(0, 7).join(" "));
    for (const line of row.bookLines) replay(row.content.fen, line);
  });
  it.each(examples)("replays teaching example: $title", example => {
    replay(example.fen, example.demonstration);
    for (const line of example.bookLines ?? []) replay(example.fen, line);
  });
  it.each([434, 448])("avoids a queen stalemate in %s", number => {
    const row = exercise(number);
    expect(replay(row.content.fen, row.bookLines[0]).isStalemate()).toBe(false);
    const board = new Chess(row.content.fen);
    board.move(row.bookLines[0].replace(/=[RB]/, "=Q"));
    expect(board.isStalemate()).toBe(true);
  });
  it("avoids stalemate after the rook sacrifice in the Saavedra study", () => {
    const row = exercise(468);
    expect(replay(row.content.fen, "c8=Q Rc4+ Qxc4").isStalemate()).toBe(true);
    expect(replay(row.content.fen, "c8=R Ra4 Kb3").isStalemate()).toBe(false);
  });
  it("uses knight promotion to escape the mating threat in the first example", () => {
    expect(replay(examples[0].fen, examples[0].bookLines![0]).isCheckmate()).toBe(true);
    expect(replay(examples[0].fen, examples[0].demonstration).isCheckmate()).toBe(false);
  });
  it("retains both black queens and distinguishes their captures in 466", () => {
    const row = exercise(466);
    const board = new Chess(row.content.fen);
    expect(board.get("e1")).toMatchObject({ type: "q", color: "b" });
    expect(board.get("h1")).toMatchObject({ type: "q", color: "b" });
    expect(row.bookLines.some(line => line.includes("Qexe4"))).toBe(true);
    expect(row.bookLines.some(line => line.includes("Qhxe4"))).toBe(true);
  });
});
