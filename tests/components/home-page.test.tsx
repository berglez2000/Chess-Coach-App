vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "test-user", name: "Chess Tester" }) }));
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const { getDashboardOverview } = vi.hoisted(() => ({ getDashboardOverview: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/games/dashboard", () => ({ getDashboardOverview }));
import HomePage from "@/app/page";
import HomeLoading from "@/app/loading";
const empty = { count: 0, recentGames: [], puzzles: 0, books: 0, progress: [], exerciseTotal: 0, exerciseCompleted: 0, plan: null };
beforeEach(() => { getDashboardOverview.mockReset(); });
it("greets the signed-in user and directs an empty library to import", async () => {
  getDashboardOverview.mockResolvedValue(empty);
  render(await HomePage());
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Good .+, Chess\./);
  expect(screen.getByText("No games yet")).toBeVisible();
  expect(screen.getAllByRole("link", { name: "Import game" })[0]).toHaveAttribute("href", "/games/new");
  expect(screen.getByRole("link", { name: "My games" })).toHaveAttribute("href", "/games");
  expect(screen.getByText(/Create and accept a weekly plan/)).toBeVisible();
});
it("shows saved counts, review links, and current exercise progress", async () => {
  getDashboardOverview.mockResolvedValue({ ...empty, count: 12, puzzles: 4, books: 2, exerciseTotal: 8, exerciseCompleted: 3,
    progress: [{ id: "material", title: "Mate in Two", completed: 3, total: 8 }], recentGames: [
      { id: "latest", whiteName: "Alice", blackName: null, result: "1-0", userColor: "BLACK", playedAt: null, createdAt: "2026-10-05T08:00:00Z", openingName: null, status: "ENGINE_COMPLETED" },
    ] });
  render(await HomePage());
  expect(screen.getByText("12")).toBeVisible();
  expect(screen.getByRole("link", { name: /Alice vs. Black/ })).toHaveAttribute("href", "/games/latest");
  expect(screen.getByText(/Opening not recorded/)).toBeVisible();
  expect(screen.getByText("Engine done")).toBeVisible();
  expect(screen.getByRole("link", { name: "Mate in Two" })).toHaveAttribute("href", "/learning/material");
  expect(screen.getAllByRole("progressbar")[0]).toHaveAttribute("aria-valuenow", "3");
  expect(screen.queryByText("No games yet")).toBeNull();
});
it("offers reload and navigation on a sanitized database error without claiming zero games", async () => {
  getDashboardOverview.mockRejectedValue(new Error("private database credentials"));
  render(await HomePage());
  expect(screen.getByRole("alert")).toHaveTextContent("local PostgreSQL");
  expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Import game" })).toBeVisible();
  expect(screen.queryByText(/private database|No games yet/)).toBeNull();
});
it("announces loading and keeps navigation available", () => {
  render(<HomeLoading />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your saved games");
  expect(screen.getByRole("link", { name: "My Games" })).toHaveAttribute("href", "/games");
});
