import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { GameReview } from "@/components/games/game-review";
import { EnginePanel, formatEvaluation } from "@/components/games/engine-panel";
import { parsePgn } from "@/lib/pgn/parse";
import type { ReviewAnalysis } from "@/lib/analysis/review";
import type { ReviewGame } from "@/types/saved-game";
const analysis: ReviewAnalysis = {
  before: { perspective: "WHITE", score: { kind: "cp", value: 50, bound: "exact" }, depth: 12, pv: ["d2d4"] },
  after: { perspective: "WHITE", score: { kind: "cp", value: -75, bound: "exact" }, depth: 12, pv: [] },
  quality: "blunder", reason: "cp_loss", cpLoss: 125, bestMoveSan: "d4", pvSan: ["d4", "d5"], runId: "run1", analyzedAt: "2026-09-22T00:00:00.000Z",
};
it.each(["WHITE", "BLACK"] as const)("synchronizes marker, board and after-move panel for %s", color => {
  const parsed = parsePgn("1. e4 e5 *");
  const game: ReviewGame = { ...parsed, moves: parsed.moves.map((move, index) => ({ ...move, analysis: index === 0 ? analysis : null })) };
  const { container } = render(<GameReview game={game} userColor={color} status="ENGINE_COMPLETED" />);
  expect(screen.getByText("Initial-position evaluation")).toBeVisible();
  expect(screen.getByText(/1 of 2 moves \(partial\)/)).toBeVisible();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Critical moves" })).getByRole("button", { name: "1. e4 · blunder" }));
  expect(screen.getByText("Current-position evaluation (after move)")).toBeVisible();
  expect(screen.getByText("-0.75 pawns · Depth 12")).toBeVisible();
  expect(screen.getByText("+0.50 pawns")).toBeVisible();
  expect(screen.getByText(/Engine choice before the played move/).parentElement).toHaveTextContent("d4");
  expect(container.querySelector('[data-square="e4"] [data-piece="wP"]')).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "End" }));
  expect(screen.getByText(/No saved engine analysis/)).toBeVisible();
  expect(screen.queryByText("125 cp")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(screen.getByText("Initial-position evaluation")).toBeVisible();
});
it("renders mate, checkmate, bounds and missing scores distinctly", () => {
  expect(formatEvaluation(null)).toBe("Not available");
  expect(formatEvaluation({ perspective: "WHITE", depth: 10, pv: [], score: { kind: "mate", value: -3, winner: "BLACK", bound: "exact" } })).toBe("Black mates in 3");
  expect(formatEvaluation({ perspective: "WHITE", depth: 0, pv: [], score: { kind: "mate", value: 0, winner: "BLACK", bound: "exact" } })).toBe("Black has delivered checkmate");
  expect(formatEvaluation({ perspective: "WHITE", depth: 10, pv: [], score: { kind: "cp", value: -20, bound: "upper" } })).toBe("Upper bound: -0.20 pawns");
  render(<EnginePanel analysis={{ ...analysis, quality: "unknown", cpLoss: null, after: null }} />);
  expect(screen.getByText(/Unclassified/)).toBeVisible();
  expect(screen.getByText("Not measured in centipawns")).toBeVisible();
});
it("warns about results from mixed partial retry runs", () => {
  const parsed = parsePgn("1. e4 e5 *");
  render(<GameReview userColor="WHITE" status="ENGINE_COMPLETED" game={{ ...parsed, moves: parsed.moves.map((move, i) => ({ ...move, analysis: { ...analysis, runId: `run${i}` } })) }} />);
  expect(screen.getByText(/multiple analysis runs/)).toBeVisible();
});
