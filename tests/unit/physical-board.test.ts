import { Chess } from "chess.js";
import { expect, it } from "vitest";
import { physicalMove, differingSquares } from "@/lib/play/physical-board";
it.each([
  ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1"],
  ["7k/P7/8/8/8/8/8/7K w - - 0 1", "a7a8n"],
  ["7k/8/8/3pP3/8/8/8/7K w - d6 0 1", "e5d6"],
])("matches complete special moves from custom positions (%s)", (fen,uci) => {
  const board = new Chess(fen); const move = board.move(uci);
  expect(physicalMove(fen,board.fen().split(" ")[0])).toEqual({ kind: "move", uci });
  const lifted = new Chess(fen); lifted.remove(move.from);
  expect(physicalMove(fen,lifted.fen().split(" ")[0])).toEqual({ kind: "incomplete" });
});
it("does not infer missing sequences or accept illegal piece placements", () => {
  const board = new Chess(); const fen = board.fen(); board.move("e4"); board.move("e5");
  expect(physicalMove(fen,board.fen().split(" ")[0]).kind).toBe("mismatch");
});

it.each([
  ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1", ["e1","f1","g1","h1"]],
  ["7k/8/8/3pP3/8/8/8/7K w - d6 0 1", "e5d6", ["d5","e5","d6"]],
])("LED guidance includes all special-move changes", (fen,move,expected) => {
  const board = new Chess(fen); board.move(move);
  expect(differingSquares(fen.split(" ")[0],board.fen())).toEqual(expected);
  expect(differingSquares(board.fen().split(" ")[0],board.fen())).toEqual([]);
});
