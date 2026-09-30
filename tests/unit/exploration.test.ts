import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { explorationFen, explorationPosition, exploreMove, type Exploration } from "@/lib/pgn/exploration";

const start = (fen = new Chess().fen()): Exploration => ({ startFen: fen, moves: [] });
describe("legal exploration", () => {
  it("rejects three-square pawn moves and wrong turns without mutating the source", () => {
    const state = start();
    expect(exploreMove(state, "e2", "e5")).toBeNull();
    expect(exploreMove(state, "e7", "e5")).toBeNull();
    const next = exploreMove(state, "e2", "e4")!;
    expect(exploreMove(next, "e7", "e5")?.moves).toEqual(["e2e4", "e7e5"]);
    expect(state.moves).toEqual([]);
  });
  it("preserves exact initial FEN and restores castling and en-passant after undo/reset", () => {
    const state = start("r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 20");
    const captured = exploreMove(state, "e5", "d6")!;
    expect(explorationPosition(captured).get("d5")).toBeUndefined();
    expect(explorationFen({ ...captured, moves: [] })).toBe(state.startFen);
    const castled = exploreMove(state, "e1", "g1")!;
    expect(explorationPosition(castled).get("f1")?.type).toBe("r");
    expect(explorationFen({ ...castled, moves: [] })).toBe(state.startFen);
    const uncapturable = start("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    expect(explorationFen(uncapturable)).toBe(uncapturable.startFen);
  });
  it.each(["q", "r", "b", "n"])("supports promotion to %s", promotion => {
    const next = exploreMove(start("7k/P7/8/8/8/8/8/K7 w - - 0 1"), "a7", "a8", promotion)!;
    expect(explorationPosition(next).get("a8")?.type).toBe(promotion);
  });
  it("rejects moves leaving the king in check and castling through check", () => {
    expect(exploreMove(start("4r2k/8/8/8/8/8/P7/4K3 w - - 0 1"), "a2", "a3")).toBeNull();
    expect(exploreMove(start("5r1k/8/8/8/8/8/8/4K2R w K - 0 1"), "e1", "g1")).toBeNull();
  });
  it.each(["7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "7k/8/8/8/8/8/8/K7 w - - 0 1"])("stops terminal positions: %s", fen => {
    expect(exploreMove(start(fen), "h8", "h7")).toBeNull();
  });
  it("retains repetition history", () => {
    let state = start();
    for (const uci of ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]) state = exploreMove(state, uci.slice(0, 2), uci.slice(2))!;
    expect(explorationPosition(state).isThreefoldRepetition()).toBe(true);
    expect(exploreMove(state, "e2", "e4")).toBeNull();
  });
});
