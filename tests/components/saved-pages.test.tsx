import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { listGames, findGame } = vi.hoisted(() => ({ listGames: vi.fn(), findGame: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/games/queries", () => ({ listGames, findGame }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import GamesPage from "@/app/games/page";
import SavedGamePage from "@/app/games/[id]/page";
import Missing from "@/app/games/[id]/not-found";
import Failure from "@/app/games/error";
import Loading from "@/app/games/loading";
afterEach(() => vi.resetAllMocks());
it("offers import from an empty library", async () => {
  listGames.mockResolvedValue([]);
  render(await GamesPage());
  expect(screen.getByText(/No saved games/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Import a game" })).toHaveAttribute("href", "/games/new");
});
it("renders summarized games with review links and fallbacks", async () => {
  listGames.mockResolvedValue([{ id: "one", whiteName: null, blackName: "Opponent", result: "*", playedAt: null, openingName: "Italian Game", userColor: "BLACK", status: "PENDING" }]);
  render(await GamesPage());
  expect(screen.getByRole("link", { name: "White vs. Opponent" })).toHaveAttribute("href", "/games/one");
  expect(screen.getByText(/Date unknown/)).toHaveTextContent("Italian Game");
  expect(screen.getByText("Analysis: pending")).toBeVisible();
});
it("uses not-found for unknown IDs", async () => {
  findGame.mockResolvedValue(null);
  await expect(SavedGamePage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NOT_FOUND");
  render(<Missing />);
  expect(screen.getByRole("link", { name: "Your games" })).toHaveAttribute("href", "/games");
});
it("shows a safe database error with retry", () => {
  const retry = vi.fn();
  render(<Failure retry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
});
it("announces loading", () => {
  render(<Loading />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
});
