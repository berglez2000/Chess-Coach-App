import { Chess, DEFAULT_POSITION } from "chess.js";
import { describe, expect, it } from "vitest";
import { autoReply, complete, EMPTY_OPENING, exportPgn, importPgn, matchingPositions, position, positionKey, practiceMove, shuffledIndices, validateContent, type OpeningContent, type PracticeState } from "@/lib/openings/content";
const content: OpeningContent = { ...EMPTY_OPENING, name: "Italian", lines: [{ name: "Italian", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"] }, { name: "Scotch", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4", "e5d4"] }] };
const fresh = (): PracticeState => ({ moves: [], target: 0, assisted: false, revealed: false });
it("validates every branch and rejects illegal, duplicate, oversized, and fabricated content", () => {
  expect(validateContent(content)).toEqual(content);
  expect(() => validateContent({ ...content, ownerId: "other" })).toThrow();
  expect(() => validateContent({ ...content, lines: [{ name: "Illegal", moves: ["e2e5"] }] })).toThrow("illegal move");
  expect(() => validateContent({ ...content, startFen: "broken" })).toThrow("FEN");
  expect(() => validateContent({ ...content, lines: [content.lines[0], content.lines[0]] })).toThrow("Duplicate");
  expect(() => validateContent({ ...content, lines: Array(101).fill(content.lines[0]) })).toThrow();
});
it("rejects impossible starting checks and castling rights", () => {
  expect(() => validateContent({ ...content, startFen: "7k/6Q1/6K1/8/8/8/8/8 w - - 0 1", lines: [] })).toThrow("non-moving king");
  expect(() => validateContent({ ...content, startFen: "7k/P7/8/8/8/8/8/7K w K - 0 1", lines: [] })).toThrow("castling rights");
});
it("rejects continued play after a terminal position", () => {
  expect(() => validateContent({ ...content, startFen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", lines: [{ name: "Ended", moves: ["h8h7"] }] })).toThrow("ended");
});
it("imports nested SAN branches and round-trips separate exported games", () => {
  const lines = importPgn('[Event "Opening"]\n\n1. e4 e5 (1... c5 2. Nf3 (2. Nc3) d6) 2. Nf3 Nc6 *', DEFAULT_POSITION);
  expect(lines.map(line => line.moves)).toEqual(expect.arrayContaining([["e2e4", "c7c5", "b1c3"], ["e2e4", "c7c5", "g1f3", "d7d6"], ["e2e4", "e7e5", "g1f3", "b8c6"]]));
  expect(importPgn(exportPgn({ ...content, lines }), DEFAULT_POSITION).map(x => x.moves)).toEqual(lines.map(x => x.moves));
});
it("ignores PGN comments, move numbers and NAGs while rejecting bad moves/unbalanced branches", () => {
  expect(importPgn('1.e4! {idea} e5 $1 2.Nf3 ; comment\nNc6 *', DEFAULT_POSITION)[0].moves).toEqual(content.lines[0].moves.slice(0, 4));
  expect(() => importPgn('1. e4 (1. d4', DEFAULT_POSITION)).toThrow("Unbalanced");
  expect(() => importPgn('1. e5 *', DEFAULT_POSITION)).toThrow("Cannot import");
  expect(() => importPgn('[FEN "8/8/8/8/8/8/6k1/4K3 w - - 0 1"]\n1. Kd1', DEFAULT_POSITION)).toThrow("differs");
});
it("matches transposed positions without clocks and excludes early universal positions", () => {
  const a = new Chess(); for (const move of ["Nf3", "d5", "d4", "Nf6"]) a.move(move);
  const b = new Chess(); for (const move of ["d4", "Nf6", "Nf3", "d5"]) b.move(move);
  expect(positionKey(a.fen())).toBe(positionKey(b.fen()));
  const keys = matchingPositions({ ...content, lines: [{ name: "Queens pawn", moves: a.history({ verbose: true }).map(m => m.lan) }] });
  expect(keys.has(positionKey(b.fen()))).toBe(true); expect(keys.has(positionKey(DEFAULT_POSITION))).toBe(false);
  expect(matchingPositions({ ...content, lines: [{ name: "Short", moves: ["e2e4"] }] }).size).toBe(0);
  expect(positionKey(a.fen().replace(/\d+ \d+$/, "15 99"))).toBe(positionKey(a.fen()));
});
it("keeps side to move, castling and capturable en-passant in position identity", () => {
  expect(positionKey(DEFAULT_POSITION.replace(" w ", " b "))).not.toBe(positionKey(DEFAULT_POSITION));
  expect(positionKey(DEFAULT_POSITION.replace(" KQkq ", " - "))).not.toBe(positionKey(DEFAULT_POSITION));
  const fen = position(DEFAULT_POSITION, ["e2e4", "a7a6", "e4e5", "d7d5"]).fen();
  expect(positionKey(fen)).not.toBe(positionKey(fen.replace(" d6 ", " - ")));
});
describe("practice", () => {
  it("separates user moves from opponent replies and accepts a different saved branch", () => {
    let state = fresh();
    state = practiceMove(content, state, "e2e4").state;
    expect(state.moves).toEqual(["e2e4"]);
    state = autoReply(content, state);
    expect(state.moves).toEqual(["e2e4", "e7e5"]);
    state = autoReply(content, practiceMove(content, state, "g1f3").state);
    state = autoReply(content, practiceMove(content, state, "d2d4").state);
    expect(state.target).toBe(1); expect(state.moves.at(-1)).toBe("e5d4"); expect(complete(content, state)).toBe(true);
    expect(practiceMove(content, state, "f3d4").outcome).toBe("ILLEGAL");
  });
  it("distinguishes wrong legal moves from illegal ones without advancing", () => {
    for (const [move, expected] of [["e2e5", "ILLEGAL"], ["d2d4", "INCORRECT"]]) { const state = fresh(); expect(practiceMove(content, state, move)).toEqual({ state, outcome: expected }); }
  });
  it("starts Black practice with an authored White move and stops at the selected endpoint", () => {
    const black = { ...content, color: "BLACK" as const };
    let state = autoReply(black, fresh()); expect(state.moves).toEqual(["e2e4"]);
    state = autoReply(black, practiceMove(black, state, "e7e5").state); expect(state.moves).toEqual(["e2e4", "e7e5", "g1f3"]);
    const prefixed = { ...content, lines: [{ name: "Short", moves: ["e2e4"] }, ...content.lines] };
    expect(complete(prefixed, { ...fresh(), target: 1, moves: ["e2e4"] })).toBe(false);
  });
  it("handles underpromotion, castling, en passant and custom Black starts", () => {
    const promotion = { ...content, startFen: "7k/P7/8/8/8/8/8/7K w - - 0 1", lines: [{ name: "Promote", moves: ["a7a8n"] }] };
    expect(practiceMove(promotion, fresh(), "a7a8n").outcome).toBe("CORRECT");
    expect(validateContent({ ...content, startFen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", lines: [{ name: "Castle", moves: ["e1g1", "e8c8"] }] }).lines).toHaveLength(1);
    expect(validateContent({ ...content, lines: [{ name: "EP", moves: ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"] }] }).lines).toHaveLength(1);
    const black = { ...content, color: "BLACK" as const, startFen: "7k/8/8/8/8/8/8/K7 b - - 0 1", lines: [] };
    // A terminal insufficient-material setup cannot be authored with further moves.
    expect(() => validateContent({ ...black, lines: [{ name: "Draw", moves: ["h8g8"] }] })).toThrow("ended");
  });
  it("shuffles a full cycle without duplicates or immediate cycle-boundary repeats", () => {
    const values = shuffledIndices(30, 0, () => 0.99); expect(new Set(values).size).toBe(30); expect(values[0]).not.toBe(0);
  });
});
