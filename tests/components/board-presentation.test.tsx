import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EvaluationBar, whitePercentage } from "@/components/chess/evaluation-bar";
import { GameReview } from "@/components/games/game-review";
import { boardTheme } from "@/components/chess/board-theme";
import { parsePgn } from "@/lib/pgn/parse";
import type { NormalizedEvaluation } from "@/types/analysis";

const cp = (value: number): NormalizedEvaluation => ({
  perspective: "WHITE", score: { kind: "cp", value, bound: "exact" }, depth: 12, pv: [],
});

it("bounds evaluations symmetrically and distinguishes mate and unavailable scores", () => {
  expect(whitePercentage(cp(0))).toBe(50);
  expect(whitePercentage(cp(230))).toBeGreaterThan(50);
  expect(whitePercentage(cp(-230))).toBeLessThan(50);
  expect(whitePercentage(cp(100000))).toBeLessThanOrEqual(100);
  expect(whitePercentage(cp(-100000))).toBeGreaterThanOrEqual(0);
  const { rerender } = render(<EvaluationBar evaluation={cp(230)} whiteBottom />);
  expect(screen.getByText("+2.3")).toBeVisible();
  expect(screen.getByTestId("evaluation-white")).toHaveStyle({ bottom: "0px" });
  rerender(<EvaluationBar evaluation={{ ...cp(0), score: { kind: "mate", value: 0, winner: "BLACK", bound: "exact" } }} whiteBottom={false} />);
  expect(screen.getByRole("img")).toHaveAccessibleName(/Black has delivered checkmate/);
  expect(screen.getByTestId("evaluation-white")).toHaveStyle({ height: "0%", top: "0px" });
  rerender(<EvaluationBar evaluation={null} whiteBottom />);
  expect(screen.getByRole("img")).toHaveAccessibleName(/Not available/);
  expect(screen.getByText("—")).toBeVisible();
});

it("slides custom pieces for 200ms and restores the displayed move's highlights going backward", () => {
  vi.useFakeTimers();
  try {
    const { container } = render(<GameReview game={parsePgn("1. e4 e5 *")} userColor="WHITE" status="PENDING" />);
    const square = (name: string) => container.querySelector(`[data-square="${name}"]`)!;
    expect(square("e2").querySelector("img")).toHaveAttribute("src", "/images/wp.png");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(square("e2").querySelector("[data-piece]")).toHaveStyle({ transform: "translate(0px, -128px)", transition: "transform 200ms" });
    expect(square("e2").lastElementChild).toHaveStyle({ backgroundColor: boardTheme.lastMoveFrom });
    expect(square("e4").lastElementChild).toHaveStyle({ backgroundColor: boardTheme.lastMoveTo });
    act(() => vi.advanceTimersByTime(200));
    expect(square("e4").querySelector("[data-piece]")).toHaveAttribute("data-piece", "wP");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    act(() => vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(square("e4").lastElementChild).toHaveStyle({ backgroundColor: boardTheme.lastMoveTo });
    expect((square("e5").lastElementChild as HTMLElement).style.backgroundColor).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect((square("e4").lastElementChild as HTMLElement).style.backgroundColor).toBe("");
    act(() => vi.advanceTimersByTime(200));
  } finally {
    vi.useRealTimers();
  }
});
