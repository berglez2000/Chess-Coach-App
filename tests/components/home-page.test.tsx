vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "test-user" }), requireApiUser: async () => ({ id: "test-user" }) }));
import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const { getDashboard } = vi.hoisted(() => ({ getDashboard: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/games/queries", () => ({ getDashboard }));
import HomePage from "@/app/page";
import HomeLoading from "@/app/loading";

beforeEach(() => { getDashboard.mockReset(); });
it("introduces the app and directs an empty library to import", async () => {
  getDashboard.mockResolvedValue({ count: 0, recentGames: [] });
  render(await HomePage());
  const main = screen.getByRole("main");
  expect(main).toHaveAttribute("id", "main-content");
  expect(within(main).getByRole("heading", { level: 1, name: "Learn from every move." })).toBeVisible();
  expect(screen.getByText("0 saved games")).toBeVisible();
  expect(screen.getByText(/No saved games yet/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Import Game" })).toHaveAttribute("href", "/games/new");
  expect(screen.getByRole("link", { name: "My Games" })).toHaveAttribute("href", "/games");
});
it("shows the full count and recent review links with metadata fallbacks", async () => {
  getDashboard.mockResolvedValue({ count: 12, recentGames: [
    { id: "latest", whiteName: "Alice", blackName: null, result: "1-0", userColor: "BLACK", playedAt: null, openingName: null, status: "ENGINE_COMPLETED" },
  ] });
  render(await HomePage());
  expect(screen.getByText("12 saved games")).toBeVisible();
  expect(screen.getByRole("link", { name: "Alice vs. Black" })).toHaveAttribute("href", "/games/latest");
  expect(screen.getByText("Date unknown")).toBeVisible();
  expect(screen.getByText("Analysis: engine completed")).toBeVisible();
  expect(screen.queryByText(/No saved games yet/)).toBeNull();
});
it("uses singular count for one saved game", async () => {
  getDashboard.mockResolvedValue({ count: 1, recentGames: [] });
  render(await HomePage());
  expect(screen.getByText("1 saved game")).toBeVisible();
});
it("offers reload and navigation on a sanitized database error without claiming zero games", async () => {
  getDashboard.mockRejectedValue(new Error("private database credentials"));
  render(await HomePage());
  expect(screen.getByRole("alert")).toHaveTextContent("local PostgreSQL");
  expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Import Game" })).toBeVisible();
  expect(screen.queryByText(/private|0 saved games/)).toBeNull();
});
it("announces loading and keeps navigation available", () => {
  render(<HomeLoading />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your saved games");
  expect(screen.getByRole("link", { name: "My Games" })).toHaveAttribute("href", "/games");
});
