import { fireEvent, render, screen } from "@testing-library/react";
import { Chess } from "chess.js";
import { afterEach, expect, it, vi } from "vitest";
import { ENDGAMES, ENDGAME_CHAPTERS, chapterPositions, endgameFeedback } from "@/lib/endgames/catalog";
import { validatePosition } from "@/lib/position-analysis/contract";
import { PlayWorkspace } from "@/components/play/workspace";
import { EndgameChapter, EndgameLibrary } from "@/components/endgames/library";

afterEach(() => vi.unstubAllGlobals());

it("offers legal, nonterminal original setups for both colors", () => {
  expect(new Set(ENDGAMES.map(item => item.id)).size).toBe(ENDGAMES.length);
  expect(new Set(ENDGAMES.map(item => item.color)).size).toBe(2);
  for (const item of ENDGAMES) {
    const board = validatePosition(item.fen);
    expect(board.isGameOver()).toBe(false);
    expect(board.turn()).toBe(item.color === "WHITE" ? "w" : "b");
  }
});

it("judges mate by the winner and draw by the stated objective", () => {
  const white = ENDGAMES[0];
  const mate = new Chess("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1");
  const stalemate = new Chess("7k/5Q2/5K2/8/8/8/8/8 b - - 0 1");
  expect(endgameFeedback(white, mate, false)).toContain("Objective reached");
  expect(endgameFeedback({ ...white, color: "BLACK" }, mate, false)).toContain("Objective not reached");
  expect(endgameFeedback(white, stalemate, false)).toContain("Objective not reached");
  expect(endgameFeedback({ ...white, objective: "draw" }, stalemate, false)).toContain("Objective reached");
  expect(endgameFeedback(white, mate, true)).toContain("You resigned");
});

it("loads the chosen setup, conceals hints, locks settings, and resets hints on restart", () => {
  vi.stubGlobal("fetch", vi.fn());
  render(<PlayWorkspace endgame={ENDGAMES[0]} />);
  expect(screen.getByLabelText("Starting FEN")).toHaveValue(ENDGAMES[0].fen);
  expect(screen.getByLabelText("Starting FEN")).toBeDisabled();
  expect(screen.getByLabelText("Your color")).toBeDisabled();
  expect(screen.getByLabelText("Opponent")).toBeDisabled();
  expect(screen.queryByText(ENDGAMES[0].hint)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show endgame hint" }));
  expect(screen.getByText(ENDGAMES[0].hint)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  expect(screen.queryByText(ENDGAMES[0].hint)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Objective feedback")).toHaveTextContent("Objective in progress");
  expect(fetch).not.toHaveBeenCalled();
});

it("organizes every position into a chapter and links to its own practice route", () => {
  expect(ENDGAME_CHAPTERS.flatMap(chapter => chapterPositions(chapter.id)).map(p => p.id).sort()).toEqual(ENDGAMES.map(p => p.id).sort());
  expect(chapterPositions("unknown")).toEqual([]);
  const { unmount } = render(<EndgameLibrary />);
  expect(screen.getByRole("link", { name: "Open King and pawn endgames" })).toHaveAttribute("href", "/endgames/king-and-pawn");
  expect(screen.queryByRole("link", { name: "Practice Convert as Black" })).not.toBeInTheDocument();
  unmount();
  render(<EndgameChapter chapter={ENDGAME_CHAPTERS[1]} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("King and pawn endgames");
  expect(screen.getByRole("link", { name: "Practice Convert as Black" })).toHaveAttribute("href", "/endgames/king-and-pawn/pawn-black");
  expect(screen.queryByRole("link", { name: "Practice King and queen" })).not.toBeInTheDocument();
});

it("publishes 50 unique imports with verified objectives and source references", () => {
  const imported = ENDGAMES.filter(position => position.source?.category === "Pawn" && position.subtopic !== "Two Pawns vs Pawn");
  expect(imported).toHaveLength(50);
  expect(imported.filter(position => position.objective === "mate")).toHaveLength(39);
  expect(imported.filter(position => position.objective === "draw")).toHaveLength(11);
  expect(new Set(ENDGAMES.map(position => position.fen.split(" ").slice(0, 4).join(" "))).size).toBe(ENDGAMES.length);
  for (const position of imported) {
    expect(position.validation?.fen).toBe(position.fen);
    expect(position.validation?.category).toBe(position.objective === "draw" ? "draw" : "win");
    expect(position.source?.position).toBeGreaterThan(0);
    expect(position.source?.url).toContain(position.source?.revision);
    expect(new Chess(position.fen).board().flat().filter(Boolean).every(piece => piece?.type === "k" || piece?.type === "p")).toBe(true);
  }
});

it("paginates the collection and filters topics without losing practice links", () => {
  const chapter = ENDGAME_CHAPTERS[1];
  const { unmount } = render(<EndgameChapter chapter={chapter} />);
  expect(screen.getAllByRole("link", { name: /^Practice / })).toHaveLength(12);
  expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/endgames/king-and-pawn?page=2");
  expect(screen.getByRole("link", { name: "Pawn vs Pawn" })).toHaveAttribute("href", "/endgames/king-and-pawn?page=1&group=Pawn+vs+Pawn");
  unmount();
  render(<EndgameChapter chapter={chapter} page={2} group="Pawn vs Pawn" />);
  expect(screen.getAllByRole("link", { name: /^Practice / })).toHaveLength(4);
  expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/endgames/king-and-pawn?page=1&group=Pawn+vs+Pawn");
  expect(screen.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
});

it("adds 60 verified positions across six chapters without changing existing identities", () => {
  expect(ENDGAME_CHAPTERS).toHaveLength(6);
  expect(ENDGAMES).toHaveLength(116);
  const added = ENDGAMES.filter(p => p.source && !(p.source.category === "Pawn" && p.subtopic !== "Two Pawns vs Pawn"));
  expect(added).toHaveLength(60);
  expect(new Set(added.map(p => p.topic)).size).toBe(6);
  for (const position of added) {
    expect(position.validation?.fen).toBe(position.fen);
    expect(position.validation?.category).toBe(position.objective === "draw" ? "draw" : "win");
    expect(new Chess(position.fen).board().flat().filter(Boolean).length).toBeLessThanOrEqual(7);
  }
});
