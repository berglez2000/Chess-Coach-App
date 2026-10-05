import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { GameReview } from "@/components/games/game-review";
import { parsePgn } from "@/lib/pgn/parse";

const pgn = '[White "Aljaz"]\n[Black "Opponent"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0';

async function expectBoard(fen: string) {
  const board = screen.getByRole("img", { name: /Game position/ });
  const pieces = new Map<string, string>(new Chess(fen).board().flat().filter((piece) => piece !== null)
    .map((piece) => [piece.square, `${piece.color}${piece.type.toUpperCase()}`]));
  expect(board.querySelectorAll("[data-square]")).toHaveLength(64);
  await waitFor(() => { for (const square of board.querySelectorAll("[data-square]")) {
    const piece = square.querySelector("[data-piece]");
    expect(piece?.getAttribute("data-piece") ?? null).toBe(pieces.get(square.getAttribute("data-square")!) ?? null);
  } });
}

describe("Game replay", () => {
  it.each(["WHITE", "BLACK"] as const)("replays the whole game forwards/backwards with %s orientation", async (color) => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor={color} status="ENGINE_COMPLETED" />);
    await expectBoard(game.initialFen);
    const board = screen.getByRole("img", { name: /Game position/ });
    expect(board.querySelector("[data-square]")).toHaveAttribute("data-square", color === "WHITE" ? "a8" : "h1");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    for (const move of game.moves) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      await expectBoard(move.fenAfter);
      expect(screen.getByRole("button", { name: `${move.moveNumber}. ${move.color === "WHITE" ? "White" : "Black"} ${move.san}` })).toHaveAttribute("aria-current", "step");
    }
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "End" })).toBeDisabled();
    for (const move of [...game.moves].reverse()) {
      fireEvent.click(screen.getByRole("button", { name: "Previous" }));
      await expectBoard(move.fenBefore);
    }
    expect(screen.getByText("Initial position · Half-move 0 of 10")).toBeVisible();
  }, 15000);

  it("selects resulting positions directly and supports Start/End", async () => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />);
    fireEvent.click(screen.getByRole("button", { name: "5. White O-O" }));
    await expectBoard(game.moves[8].fenAfter);
    expect(screen.getByText("Move 5. O-O · Half-move 9 of 10")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "End" }));
    await expectBoard(game.finalPosition.fen);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await expectBoard(game.initialFen);
    expect(screen.getByRole("table", { name: "Game moves" }).querySelector('[aria-current="step"]')).toBeNull();
  });

  it("replays a Black-to-move FEN without shifting move numbers or columns", async () => {
    const game = parsePgn('[SetUp "1"]\n[FEN "7k/8/8/8/8/8/8/KR6 b - - 0 23"]\n23... Kh7 24. Rb2 Kh6 *');
    render(<GameReview game={game} userColor="BLACK" status="ENGINE_COMPLETED" />);
    await expectBoard(game.initialFen);
    const firstRow = screen.getByRole("row", { name: /23\./ });
    expect(within(firstRow).getAllByRole("cell")[0]).toHaveTextContent("—");
    fireEvent.click(screen.getByRole("button", { name: "23. Black Kh7" }));
    await expectBoard(game.moves[0].fenAfter);
    expect(screen.getByText("Move 23... Kh7 · Half-move 1 of 3")).toBeVisible();
  });

  it("shows available metadata and fallback player names", () => {
    render(<GameReview game={parsePgn('[Date "2026.09.21"]\n[Opening "Test opening"]\n[ECO "A00"]\n[TimeControl "600+5"]\n1. e4 *')} userColor="WHITE" status="PENDING" />);
    expect(screen.getByRole("heading", { name: "White vs. Black" })).toBeVisible();
    expect(screen.getByText("2026-09-21")).toBeVisible();
    expect(screen.getByText("Test opening (A00)")).toBeVisible();
    expect(screen.getByText("10 min + 5 sec")).toBeVisible();
  });
});

describe("Flip board", () => {
  it("toggles orientation without changing selected ply", () => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />);
    const board = screen.getByRole("img", { name: /Game position/ });
    expect(board).toHaveAccessibleName(/White at the bottom/);
    // advance one ply
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Half-move 1 of/)).toBeVisible();
    // flip
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    expect(board).toHaveAccessibleName(/Black at the bottom/);
    // ply unchanged
    expect(screen.getByText(/Half-move 1 of/)).toBeVisible();
    // flip back
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    expect(board).toHaveAccessibleName(/White at the bottom/);
  });

  it("flip button aria-pressed reflects state", () => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />);
    const btn = screen.getByRole("button", { name: "Flip board" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("Black userColor flips to White at bottom", () => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor="BLACK" status="ENGINE_COMPLETED" />);
    const board = screen.getByRole("img", { name: /Game position/ });
    expect(board).toHaveAccessibleName(/Black at the bottom/);
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    expect(board).toHaveAccessibleName(/White at the bottom/);
  });
});

describe("Keyboard navigation", () => {
  it("ArrowRight advances ply and ArrowLeft retreats", () => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />);
    expect(screen.getByText(/Half-move 0 of/)).toBeVisible();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText(/Half-move 1 of/)).toBeVisible();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText(/Half-move 2 of/)).toBeVisible();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText(/Half-move 1 of/)).toBeVisible();
  });

  it("does not go below 0 or above total", () => {
    const game = parsePgn(pgn);
    render(<GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />);
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText(/Half-move 0 of/)).toBeVisible();
    for (let i = 0; i < game.moves.length + 2; i++) {
      fireEvent.keyDown(document, { key: "ArrowRight" });
    }
    expect(screen.getByText(new RegExp(`Half-move ${game.moves.length} of`))).toBeVisible();
  });

  it("ignores arrow keys when an input is focused", () => {
    const game = parsePgn(pgn);
    const { container } = render(
      <>
        <input data-testid="text-field" />
        <GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />
      </>
    );
    const input = container.querySelector("input[data-testid='text-field']") as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(screen.getByText(/Half-move 0 of/)).toBeVisible();
  });
});

it("shows supplied player ratings and clocks, follows replay and hides missing clock samples", () => {
  const game = parsePgn('[White "Aljaz"]\n[Black "Opponent"]\n[WhiteElo "1719"]\n1. e4 {[%clk 0:09:58]} e5 {[%clk 0:09:55]} 2. Nf3 *');
  render(<GameReview game={game} userColor="WHITE" status="PENDING" />);
  expect(screen.getByText("(1719)")).toBeVisible();
  expect(screen.queryByLabelText("Aljaz clock")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Aljaz clock")).toHaveTextContent("9:58");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Opponent clock")).toHaveTextContent("9:55");
  fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
  expect(screen.getByLabelText("Aljaz clock")).toHaveTextContent("9:58");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.queryByLabelText("Aljaz clock")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(screen.queryByLabelText("Opponent clock")).toBeNull();
});

it("switches review tabs by keyboard without advancing replay", () => {
  render(<GameReview game={parsePgn("1. e4 e5 *")} userColor="WHITE" status="PENDING" />);
  const coaching = screen.getByRole("tab", { name: "Coaching" });
  fireEvent.keyDown(coaching, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Moves" })).toHaveFocus();
  expect(screen.getByRole("tab", { name: "Moves" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText(/Half-move 0 of/)).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Engine" }));
  expect(screen.getByRole("region", { name: "Engine analysis" })).toBeVisible();
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Engine");
});
