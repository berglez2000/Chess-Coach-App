import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameReview } from "@/components/games/game-review";
import { parsePgn } from "@/lib/pgn/parse";

afterEach(() => { vi.unstubAllGlobals(); });

function stubSave(failure?: string) {
  const save = vi.fn(async (_url: string, init: RequestInit) => failure
    ? Response.json({ error: { message: failure } }, { status: 500 })
    : Response.json({ note: JSON.parse(String(init.body)).text.trim() || null }));
  vi.stubGlobal("fetch", save);
  return save;
}

it("offers no notes for a game that is not saved", () => {
  render(<GameReview game={parsePgn("1. e4 e5 *")} userColor="WHITE" status="ENGINE_COMPLETED" />);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.queryByRole("button", { name: /Add a note/ })).toBeNull();
});

it("saves, shows, edits and deletes a note on the game and on a move", async () => {
  const save = stubSave();
  const parsed = parsePgn("1. e4 e5 2. Nf3 *");
  const game = { ...parsed, moves: parsed.moves.map(move => move.ply === 2 ? { ...move, note: "Symmetrical reply" } : move) };
  render(<GameReview game={game} gameId="game-1" userColor="WHITE" status="ENGINE_COMPLETED" />);

  fireEvent.click(screen.getByRole("button", { name: "+ Add a note on this game" }));
  fireEvent.change(screen.getByLabelText("Your note on this game"), { target: { value: " Lost the thread in the endgame \n" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.getByRole("region", { name: "Your note on this game" })).toHaveTextContent("Lost the thread in the endgame"));
  expect(save).toHaveBeenLastCalledWith("/api/games/game-1/notes", expect.objectContaining({ method: "PUT", body: JSON.stringify({ ply: null, text: " Lost the thread in the endgame \n" }) }));

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Add a note on 1. e4" }));
  const field = screen.getByLabelText("Your note on 1. e4");
  fireEvent.change(field, { target: { value: "Main line" } });
  // Typing in the note must not step through the game.
  fireEvent.keyDown(field, { key: "ArrowRight" });
  expect(screen.getByText(/Half-move 1 of 3/)).toBeVisible();
  fireEvent.keyDown(field, { key: "Enter", metaKey: true });
  await waitFor(() => expect(screen.getByRole("region", { name: "Your note on 1. e4" })).toHaveTextContent("Main line"));
  expect(JSON.parse(String(save.mock.lastCall![1].body))).toEqual({ ply: 1, text: "Main line" });
  expect(screen.getByRole("button", { name: "1. White e4 — Has your note" })).toHaveAttribute("aria-current", "step");

  // A note loaded with the game is shown for its move and can be removed.
  fireEvent.click(screen.getByRole("button", { name: "1. Black e5 — Has your note" }));
  expect(screen.getByRole("region", { name: "Your note on 1… e5" })).toHaveTextContent("Symmetrical reply");
  fireEvent.click(screen.getByRole("button", { name: "Edit note on 1… e5" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
  expect(await screen.findByRole("button", { name: "+ Add a note on 1… e5" })).toBeVisible();
  expect(JSON.parse(String(save.mock.lastCall![1].body))).toEqual({ ply: 2, text: "" });
  expect(screen.getByRole("button", { name: "1. Black e5" })).toBeVisible();
});

it("keeps the draft and reports a failed save", async () => {
  stubSave("Could not save this note. Please try again.");
  render(<GameReview game={parsePgn("1. e4 *")} gameId="game-1" userColor="WHITE" status="ENGINE_COMPLETED" />);
  fireEvent.click(screen.getByRole("button", { name: "+ Add a note on this game" }));
  fireEvent.change(screen.getByLabelText("Your note on this game"), { target: { value: "Draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save this note");
  expect(screen.getByLabelText("Your note on this game")).toHaveValue("Draft");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "+ Add a note on this game" })).toBeVisible();
});
