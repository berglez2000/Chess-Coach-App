import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OpeningEditor } from "@/components/openings/editor";
import { OpeningPractice } from "@/components/openings/practice";
import { EMPTY_OPENING } from "@/lib/openings/content";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
const content = { ...EMPTY_OPENING, name: "King pawn", lines: [{ name: "Line one", moves: ["e2e4", "e7e5", "g1f3"] }] };
function play(move: string) { fireEvent.change(screen.getByLabelText("Move coordinates"), { target: { value: move } }); fireEvent.click(screen.getByRole("button", { name: "Play move" })); }
it("authors board moves, creates branches, rejects illegality and retains edits on failed saves", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Stale edit" } }) }); vi.stubGlobal("fetch", fetch);
  render(<OpeningEditor initial={{ ...content, id: "opening", revision: 0, videos: [] }} />);
  play("e2e5"); expect(screen.getByRole("alert")).toBeVisible();
  play("d2d4"); expect(screen.getByText("Variations (2)")).toBeVisible(); expect(screen.getByLabelText("Variation 2 name")).toHaveValue("Variation 2");
  play("d7d5"); expect(screen.getByText("Variations (2)")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Save opening" })); await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Stale edit"));
  expect(screen.getByLabelText("Variation 2 name")).toHaveValue("Variation 2");
  expect(JSON.parse(fetch.mock.calls[0][1].body).content.lines[1].moves).toEqual(["d2d4", "d7d5"]);
});
it("conceals the selected solution, plays replies, handles incorrect moves, hint/retry/reveal and completion", async () => {
  render(<OpeningPractice content={content} />); expect(screen.queryByText("Authored solution")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start practice" })); play("d2d4"); expect(screen.getByRole("status", { name: "Practice feedback" })).toHaveTextContent("not in a saved branch");
  play("e2e4"); expect(await screen.findByText("Played: e4 · e5", {}, { timeout: 2500 })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Hint" })); expect(screen.getByText("Try Nf3.")).toBeVisible();
  play("g1f3"); expect(screen.getByRole("heading", { name: "Variation complete" })).toBeVisible(); expect(screen.getByText(/Completed with assistance/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry variation" })); expect(screen.queryByText("Authored solution")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reveal" })); expect(screen.getByText("Authored solution")).toBeVisible(); expect(screen.getByRole("button", { name: "Play move" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next variation" })); expect(screen.queryByText("Authored solution")).not.toBeInTheDocument();
});
