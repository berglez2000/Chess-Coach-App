import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { randomUUID } from "node:crypto";
import exercises from "../../data/learning/mate-in-four.json";
import { contentSchema, SAMPLE_CONTENT, validateContent } from "../../lib/learning/content";
import { proveAuthoredMate } from "../../scripts/authored-mate-proof";
import { applyPuzzleAction, INITIAL_PROGRESS } from "../../lib/puzzles/solve";

function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  return board;
}
const byNumber = (number: number) => exercises.find(row => row.order === number)!;

describe("Mate in 4 chapter", () => {
  it("covers all 33 source diagrams in order with page references", () => {
    expect(exercises.map(row => row.order)).toEqual(Array.from({ length: 33 }, (_, i) => 946 + i));
    for (const row of exercises) {
      const page = row.order < 955 ? 117 : row.order < 967 ? 118 : 119;
      const content = contentSchema.parse(row.content);
      expect(row.number).toBe(String(row.order));
      expect(content.objective).toBe("MATE");
      expect(content.mateIn).toBe(4);
      expect(content.solver).toBe("WHITE");
      expect(new Chess(content.fen).turn()).toBe("w");
      expect(content.diagramPage).toBe(String(page));
      expect(content.pdfPage).toBe(page - 10);
      expect(content.answerPage).toBe("142");
    }
  });
  it.each(exercises)("reaches mate in every printed line for $number", row => {
    expect(row.content.solutionText).toBe(row.bookLines[0]);
    for (const line of row.bookLines) {
      expect(line.split(" ").length).toBeLessThanOrEqual(7);
      expect(replay(row.content.fen, line).isCheckmate()).toBe(true);
    }
  });
  it("preserves the quiet move, promotion, and disambiguated knight moves", () => {
    expect(byNumber(947).content.solutionText).toContain("g8=Q+");
    expect(byNumber(960).content.solutionText).toMatch(/^Rd7 /);
    expect(byNumber(961).content.solutionText).toContain("N5g6+");
    expect(byNumber(975).content.solutionText).toContain("Nhg6+");
    expect(byNumber(975).content.solutionText).toContain("N5g6#");
  });
  it("uses the four-move trainer through the promotion and zugzwang", () => {
    const row = byNumber(947);
    const content = contentSchema.parse(row.content);
    const validation = proveAuthoredMate(content, row.bookLines);
    const definition = { id: "947", startingFen: row.content.fen, playerColor: content.solver,
      sourcePly: 0, generation: { gameId: "" }, acceptedMoves: validation.acceptedMoves, solution: validation.solution };
    const board = replay(row.content.fen, row.content.solutionText);
    const authored = board.history({ verbose: true }).filter((_, i) => i % 2 === 0).map(move => move.lan);
    let state = { ...INITIAL_PROGRESS };
    for (const move of authored) state = applyPuzzleAction(definition, state, {
      action: "MOVE", move, requestId: randomUUID(), expectedRevision: state.revision,
    });
    expect(state.state).toBe("SOLVED");
    expect(state.playedMoves).toHaveLength(7);
  });
});

describe("Offline authored mate proof", () => {
  it.each([
    SAMPLE_CONTENT,
    { ...SAMPLE_CONTENT, fen: "k7/2P5/1K6/8/8/8/8/8 w - - 0 1", mateIn: 4, solutionText: "c8=Q#" },
    { ...SAMPLE_CONTENT, fen: "3r1r1k/ppp3pp/7N/8/8/1Q6/8/6K1 w - - 4 3", mateIn: 2, solutionText: "Qg8+ Rxg8 Nf7#" },
  ])("agrees with the existing verifier on authored roots", content => {
    const standard = validateContent(content);
    const offline = proveAuthoredMate(content);
    expect(offline.fingerprint).toBe(standard.fingerprint);
    for (const root of offline.acceptedMoves) expect(standard.acceptedMoves).toContain(root);
    expect(offline.solution.lines.every(line => line.goal === "mate")).toBe(true);
  });
  it("rejects a cooperative mating line when another defense prevents mate", () => {
    expect(() => proveAuthoredMate({ ...SAMPLE_CONTENT,
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR w KQkq - 0 2",
      mateIn: 2, solutionText: "Bc4 Nc6 Qxf7#",
    })).toThrow("does not force mate against every defense");
  });
  it("enforces search budgets and mating goals", () => {
    expect(() => proveAuthoredMate(SAMPLE_CONTENT, [], { nodes: 0, milliseconds: 5000 })).toThrow("search limit");
    expect(() => proveAuthoredMate({ ...SAMPLE_CONTENT, solutionText: "Ra2" })).toThrow("reach checkmate");
    expect(() => proveAuthoredMate({ ...SAMPLE_CONTENT, objective: "SEQUENCE" })).toThrow("mating puzzle");
  });
});
