import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameReview } from "@/components/games/game-review";
import { parsePgn } from "@/lib/pgn/parse";

afterEach(() => { vi.unstubAllGlobals(); });

/** Engine fixture: answers each request with the next scripted move. */
function stubEngine(...replies: (string | Response)[]) {
  const engine = vi.fn(async (_url: string, init: RequestInit) => {
    void init;
    const reply = replies.shift();
    return reply instanceof Response ? reply : Response.json({ move: reply });
  });
  vi.stubGlobal("fetch", engine);
  return engine;
}
const sent = (engine: ReturnType<typeof stubEngine>, call: number) => JSON.parse(String(engine.mock.calls[call][1].body));
const board = () => screen.getByLabelText(/Practice position/);
async function piece(square: string, value: string | null) {
  await waitFor(() => expect(board().querySelector(`[data-square="${square}"] [data-piece]`)?.getAttribute("data-piece") ?? null).toBe(value));
}
const status = () => screen.getByRole("status", { name: "Practice status" });

it("plays the selected position on against the engine and returns to the review", async () => {
  const game = parsePgn("1. e4 e5 2. Nf3 *");
  const engine = stubEngine("e7e5", "b8c6", new Response(JSON.stringify({ error: { message: "Stockfish could not reply. Check the engine configuration and retry." } }), { status: 503 }), "g8f6");
  render(<GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Play on against the engine" }));

  // After 1. e4 it is Black's move, so the engine replies first.
  await piece("e5", "bP");
  expect(sent(engine, 0)).toEqual({ startFen: game.moves[0].fenAfter, moves: [], color: "WHITE", difficulty: "strong" });
  await waitFor(() => expect(status()).toHaveTextContent("Your turn"));
  expect(screen.getByRole("button", { name: "Take back" })).toBeDisabled();
  expect(screen.queryByText("Engine details")).toBeNull();

  fireEvent.click(board().querySelector('[data-square="e5"]')!);
  fireEvent.click(board().querySelector('[data-square="g1"]')!); fireEvent.click(board().querySelector('[data-square="f3"]')!);
  await piece("c6", "bN");
  expect(sent(engine, 1).moves).toEqual(["e7e5", "g1f3"]);
  expect(screen.getByLabelText("Practice moves")).toHaveTextContent("1… e5 2. Nf3 2… Nc6");

  fireEvent.click(screen.getByRole("button", { name: "Take back" }));
  await piece("g1", "wN"); await piece("b8", "bN");
  expect(engine).toHaveBeenCalledTimes(2);

  // A failed reply pauses the game until it is retried.
  fireEvent.keyDown(document, { key: "ArrowRight" });
  fireEvent.click(board().querySelector('[data-square="d2"]')!); fireEvent.click(board().querySelector('[data-square="d4"]')!);
  expect(await screen.findByRole("alert")).toHaveTextContent("Stockfish could not reply");
  expect(status()).toHaveTextContent("Stockfish is paused");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await piece("f6", "bN");
  expect(sent(engine, 3).moves).toEqual(["e7e5", "d2d4"]);

  fireEvent.click(screen.getByRole("button", { name: "Return to review" }));
  expect(screen.getByText("Move 1. e4 · Half-move 1 of 3")).toBeVisible();
  expect(screen.queryByLabelText(/Practice position/)).toBeNull();
});

it("lets the player move first, promote, and win", async () => {
  HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };
  const engine = stubEngine();
  render(<GameReview game={parsePgn('[SetUp "1"]\n[FEN "k7/2P5/1K6/8/8/8/8/8 w - - 0 1"]\n\n1. Kc6 *')} userColor="WHITE" status="PENDING" />);
  fireEvent.click(screen.getByRole("button", { name: "Play on against the engine" }));
  expect(status()).toHaveTextContent("Your turn");
  fireEvent.click(board().querySelector('[data-square="c7"]')!); fireEvent.click(board().querySelector('[data-square="c8"]')!);
  fireEvent.click(await screen.findByRole("button", { name: "Promote to queen" }));
  await piece("c8", "wQ");
  expect(status()).toHaveTextContent("Checkmate · You won");
  expect(engine).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Start again" }));
  await piece("c7", "wP");
});

it("cannot play on from a finished position", () => {
  render(<GameReview game={parsePgn("1. f3 e5 2. g4 Qh4# 0-1")} userColor="WHITE" status="PENDING" />);
  fireEvent.click(screen.getByRole("button", { name: "End" }));
  expect(screen.getByRole("button", { name: "Play on against the engine" })).toBeDisabled();
});
