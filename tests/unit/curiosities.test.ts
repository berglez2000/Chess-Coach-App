import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { randomUUID } from "node:crypto";
import exercises from "../../data/learning/curiosities.json";
import examples from "../../data/learning/curiosities-lesson.json";
import { contentSchema, validateContent } from "../../lib/learning/content";
import { applyPuzzleAction, INITIAL_PROGRESS } from "../../lib/puzzles/solve";

function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  return board;
}
const byNumber = (number: number) => exercises.find(row => row.order === number)!;

describe("Curiosities final chapter", () => {
  it("covers the last 23 exercises with their source references and correct side to move", () => {
    expect(exercises.map(row => row.order)).toEqual(Array.from({ length: 23 }, (_, i) => 979 + i));
    for (const row of exercises) {
      expect(row.number).toBe(String(row.order));
      expect(row.content.diagramPage).toBe(row.order < 991 ? "122" : "123");
      expect(row.content.pdfPage).toBe(row.order < 991 ? 112 : 113);
      expect(row.content.answerPage).toBe(row.order === 979 ? "142" : "143");
      expect(row.content.solver).toBe([981, 985, 990, 995].includes(row.order) ? "BLACK" : "WHITE");
    }
  });
  it.each(exercises)("validates practice and all source variations for $number", row => {
    const content = contentSchema.parse(row.content);
    const validation = validateContent(content);
    expect(validation.acceptedMoves.length).toBeGreaterThan(0);
    const moves = row.bookLines[0].split(" ");
    expect(content.solutionText).toBe(moves.slice(0, Math.min(7, moves.length % 2 ? moves.length : moves.length - 1)).join(" "));
    for (const line of [...row.bookLines, ...("analysisLines" in row ? row.analysisLines ?? [] : [])]) replay(content.fen, line);
  });
  it("proves mate in two and records the corrected source typo in 979", () => {
    const row = byNumber(979);
    expect(validateContent(row.content).method).toBe("exhaustive-forced-mate-v1");
    for (const line of row.bookLines) expect(replay(row.content.fen, line).isCheckmate()).toBe(true);
    expect(row.content.explanation).toContain("...gxf6 is a typo");
  });
  it("preserves knight underpromotion and the three-knight stalemate", () => {
    expect(replay(byNumber(982).content.fen, "h8=N+").get("h8")).toMatchObject({ type: "n", color: "w" });
    expect(replay(byNumber(982).content.fen, "h8=Q").isStalemate()).toBe(true);
    expect(replay(byNumber(982).content.fen, "h8=R").isStalemate()).toBe(true);
    expect(replay(byNumber(989).content.fen, byNumber(989).bookLines[0]).isStalemate()).toBe(true);
  });
  it.each([990, 1001])("reaches mate in every winning book line for %s", number => {
    const row = byNumber(number);
    for (const line of row.bookLines) expect(replay(row.content.fen, line).isCheckmate()).toBe(true);
  });
  it.each([982, 989, 995, 999, 1001])("plays the published practice through the solver for %s", number => {
    const row = byNumber(number);
    const content = contentSchema.parse(row.content);
    const validation = validateContent(content);
    const definition = { id: row.number, startingFen: content.fen, playerColor: content.solver,
      sourcePly: 0, generation: { gameId: "" }, acceptedMoves: validation.acceptedMoves, solution: validation.solution };
    const moves = replay(content.fen, content.solutionText).history({ verbose: true }).filter((_, i) => i % 2 === 0);
    let state = { ...INITIAL_PROGRESS };
    for (const move of moves) state = applyPuzzleAction(definition, state, {
      action: "MOVE", move: move.lan, requestId: randomUUID(), expectedRevision: state.revision,
    });
    expect(state.state).toBe("SOLVED");
  });
  it.each(examples)("replays the introductory problem: $title", example => {
    for (const line of [example.demonstration, ...example.bookLines]) expect(replay(example.fen, line).isCheckmate()).toBe(true);
  });
});
