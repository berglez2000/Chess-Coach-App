import { fireEvent, render, screen, within } from "@testing-library/react";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { GameReview } from "@/components/games/game-review";
import { parsePgn } from "@/lib/pgn/parse";

const pgn = '[White "Aljaz"]\n[Black "Opponent"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0';

function expectBoard(fen: string) {
  const board = screen.getByRole("img", { name: /Game position/ });
  const pieces = new Map<string, string>(new Chess(fen).board().flat().filter((piece) => piece !== null)
    .map((piece) => [piece.square, `${piece.color}${piece.type.toUpperCase()}`]));
  expect(board.querySelectorAll("[data-square]")).toHaveLength(64);
  for (const square of board.querySelectorAll("[data-square]")) {
    const piece = square.querySelector("[data-piece]");
    expect(piece?.getAttribute("data-piece") ?? null).toBe(pieces.get(square.getAttribute("data-square")!) ?? null);
  }
}

describe("Game replay", () => {
  it.each(["WHITE", "BLACK"] as const)("replays the whole game forwards/backwards with %s orientation", (color) => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor={color} status="ENGINE_COMPLETED" />);
    expectBoard(game.initialFen);
    const board = screen.getByRole("img", { name: /Game position/ });
    expect(board.querySelector("[data-square]")).toHaveAttribute("data-square", color === "WHITE" ? "a8" : "h1");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    for (const move of game.moves) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expectBoard(move.fenAfter);
      expect(screen.getByRole("button", { name: `${move.moveNumber}. ${move.color === "WHITE" ? "White" : "Black"} ${move.san}` })).toHaveAttribute("aria-current", "step");
    }
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "End" })).toBeDisabled();
    for (const move of [...game.moves].reverse()) {
      fireEvent.click(screen.getByRole("button", { name: "Previous" }));
      expectBoard(move.fenBefore);
    }
    expect(screen.getByText("Initial position · Half-move 0 of 10")).toBeVisible();
  });

  it("selects resulting positions directly and supports Start/End", () => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />);
    fireEvent.click(screen.getByRole("button", { name: "5. White O-O" }));
    expectBoard(game.moves[8].fenAfter);
    expect(screen.getByText("Move 5. O-O · Half-move 9 of 10")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "End" }));
    expectBoard(game.finalPosition.fen);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expectBoard(game.initialFen);
    expect(screen.getByRole("table", { name: "Game moves" }).querySelector('[aria-current="step"]')).toBeNull();
  });

  it("replays a Black-to-move FEN without shifting move numbers or columns", () => {
    const game = parsePgn('[SetUp "1"]\n[FEN "7k/8/8/8/8/8/8/KR6 b - - 0 23"]\n23... Kh7 24. Rb2 Kh6 *');
    render(<GameReview game={game} userColor="BLACK" status="ENGINE_COMPLETED" />);
    expectBoard(game.initialFen);
    const firstRow = screen.getByRole("row", { name: /23\./ });
    expect(within(firstRow).getAllByRole("cell")[0]).toHaveTextContent("—");
    fireEvent.click(screen.getByRole("button", { name: "23. Black Kh7" }));
    expectBoard(game.moves[0].fenAfter);
    expect(screen.getByText("Move 23... Kh7 · Half-move 1 of 3")).toBeVisible();
  });

  it("shows available metadata and fallback player names", () => {
    render(<GameReview game={parsePgn('[Date "2026.09.21"]\n[Opening "Test opening"]\n[ECO "A00"]\n[TimeControl "600+5"]\n1. e4 *')} userColor="WHITE" status="PENDING" />);
    expect(screen.getByText("White (White) vs. Black (Black)")).toBeVisible();
    expect(screen.getByText("2026-09-21")).toBeVisible();
    expect(screen.getByText("Test opening (A00)")).toBeVisible();
    expect(screen.getByText("600+5")).toBeVisible();
  });
});
