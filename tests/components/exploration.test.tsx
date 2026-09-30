import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameReview } from "@/components/games/game-review";
import { ExplorationBoard } from "@/components/chess/exploration-board";
import { parsePgn } from "@/lib/pgn/parse";

function square(name: string) { return screen.getByRole("group", { name: /Exploration position/ }).querySelector(`[data-square="${name}"]`)!; }
async function piece(name: string, value: string | null) {
  await waitFor(() => expect(square(name).querySelector("[data-piece]")?.getAttribute("data-piece") ?? null).toBe(value));
}
function play(uci: string) {
  fireEvent.change(screen.getByLabelText("Move coordinates"), { target: { value: uci } });
  fireEvent.click(screen.getByRole("button", { name: "Play move" }));
}
describe("exploration interactions", () => {
  it.each(["WHITE", "BLACK"] as const)("explores both sides and restores review in %s orientation", async userColor => {
    const game = parsePgn("1. e4 e5 2. Nf3 *");
    const saved = JSON.stringify(game);
    render(<GameReview game={game} userColor={userColor} status="ENGINE_COMPLETED" />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore position" }));
    expect(screen.getByRole("group", { name: /Exploration position/ })).toHaveAccessibleName(new RegExp(`${userColor === "WHITE" ? "White" : "Black"} at the bottom`));
    fireEvent.click(square("e7")); fireEvent.click(square("e4"));
    expect(screen.getByRole("alert")).toHaveTextContent("Illegal move");
    fireEvent.click(square("e7")); fireEvent.click(square("e5"));
    await piece("e5", "bP");
    play("g1f3"); await piece("f3", "wN");
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("group", { name: /Exploration position/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo" })); await piece("g1", "wN");
    fireEvent.click(screen.getByRole("button", { name: "Reset variation" })); await piece("e7", "bP");
    await piece("e4", "wP");
    expect(screen.getByLabelText("Explored moves")).toHaveTextContent("No moves yet");
    fireEvent.click(screen.getByRole("button", { name: "Return to review" }));
    expect(screen.getByText("Move 1. e4 · Half-move 1 of 3")).toBeVisible();
    expect(JSON.stringify(game)).toBe(saved);
    fireEvent.click(screen.getByRole("button", { name: "Explore position" }));
    fireEvent.click(screen.getByRole("button", { name: "2. White Nf3" }));
    expect(screen.queryByRole("group", { name: /Exploration position/ })).toBeNull();
    expect(screen.getByText("Move 2. Nf3 · Half-move 3 of 3")).toBeVisible();
  });
  it("promotes and resets from a custom Black-to-move FEN", async () => {
    render(<ExplorationBoard startFen="7k/8/8/8/8/8/p7/7K b - - 0 23" userColor="BLACK" flipped={false} onExit={() => {}} />);
    fireEvent.change(screen.getByLabelText("Promotion piece"), { target: { value: "n" } });
    fireEvent.click(square("a2")); fireEvent.click(square("a1"));
    await piece("a1", "bN");
    expect(screen.getByRole("status", { name: "Variation status" })).toHaveTextContent("Draw");
    fireEvent.click(screen.getByRole("button", { name: "Reset variation" }));
    await piece("a2", "bP");
    expect(screen.getByRole("status", { name: "Variation status" })).toHaveTextContent("Black to play");
  });
});

it("starts the better-move variation before the mistake and restores annotations", async () => {
  const parsed = parsePgn("1. f3 e5 *");
  const game = { ...parsed, moves: parsed.moves.map((move, index) => ({ ...move, analysis: index === 0 ? {
    before: null, after: { perspective: "WHITE" as const, score: { kind: "cp" as const, value: -150, bound: "exact" as const }, depth: 12, pv: [] },
    quality: "mistake" as const, reason: "cp_loss", cpLoss: 150, bestMoveSan: "e4", pvSan: ["e4"], runId: "fixture", analyzedAt: "2026-09-30",
  } : null })) };
  render(<GameReview game={game} userColor="WHITE" status="ENGINE_COMPLETED" />);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("-1.5")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Try the better move" }));
  await piece("f2", "wP");
  expect(screen.queryByText("-1.5")).toBeNull();
  expect(screen.queryByText("Engine details")).toBeNull();
  play("e2e4"); await piece("e4", "wP");
  fireEvent.click(screen.getByRole("button", { name: "Return to review" }));
  expect(screen.getByText("Move 1. f3 · Half-move 1 of 2")).toBeVisible();
  expect(screen.getByText("-1.5")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Explore position" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(screen.getByText("Initial position · Half-move 0 of 2")).toBeVisible();
});
