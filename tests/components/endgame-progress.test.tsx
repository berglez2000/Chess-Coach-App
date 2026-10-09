import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlayWorkspace } from "@/components/play/workspace";
import { ENDGAMES } from "@/lib/endgames/catalog";
import { EMPTY_ENDGAME_PROGRESS, type EndgameSnapshot } from "@/lib/endgames/progress";
afterEach(() => vi.unstubAllGlobals());
const snapshot: EndgameSnapshot = { sessionId: "aa111111-1111-4111-8111-111111111111", difficulty: "casual", moves: ["d2d3"], resigned: false, hintUsed: true, analysisUsed: false };
it("restores the exact saved game paused, retains hints, and does not issue an engine reply", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<PlayWorkspace endgame={ENDGAMES[0]} initialProgress={{ ...EMPTY_ENDGAME_PROGRESS, revision: 2, snapshot, attempts: 1 }} />);
  expect(screen.getByLabelText("Game status")).toHaveTextContent("Play paused");
  expect(screen.getByLabelText("Game moves")).toHaveTextContent("Qd3");
  expect(screen.getByText(ENDGAMES[0].hint)).toBeVisible();
  expect(screen.getByLabelText("Saved practice progress")).toHaveTextContent("1 attempts · Saved");
  expect(fetcher).not.toHaveBeenCalled();
});
it("pauses on save failure and retries the exact request before allowing play", async () => {
  const bodies: unknown[] = [];
  const fetcher = vi.fn(async (_url, options) => {
    const input = JSON.parse(options.body); bodies.push(input);
    if (bodies.length === 1) throw new Error("Connection lost. Retry save.");
    return { ok: true, json: async () => ({ progress: { ...EMPTY_ENDGAME_PROGRESS, revision: 1, attempts: 1, snapshot: input.snapshot } }) };
  }); vi.stubGlobal("fetch", fetcher);
  render(<PlayWorkspace endgame={ENDGAMES[0]} initialProgress={EMPTY_ENDGAME_PROGRESS} />);
  fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  await screen.findByText("Connection lost. Retry save.");
  expect(screen.getByLabelText("Move coordinates")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Restart with these settings" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await waitFor(() => expect(screen.getByLabelText("Move coordinates")).toBeEnabled());
  expect(bodies[1]).toEqual(bodies[0]);
  expect(screen.getByLabelText("Saved practice progress")).toHaveTextContent("1 attempts · Saved");
});
it("saves hint assistance while retaining a restored paused game", async () => {
  const fetcher = vi.fn(async (_url, options) => ({ ok: true, json: async () => ({ progress: { ...EMPTY_ENDGAME_PROGRESS, revision: 2, attempts: 1, snapshot: JSON.parse(options.body).snapshot } }) }));
  vi.stubGlobal("fetch", fetcher);
  render(<PlayWorkspace endgame={ENDGAMES[0]} initialProgress={{ ...EMPTY_ENDGAME_PROGRESS, revision: 1, snapshot: { ...snapshot, hintUsed: false }, attempts: 1 }} />);
  fireEvent.click(screen.getByRole("button", { name: "Show endgame hint" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetcher.mock.calls[0][1].body).snapshot.hintUsed).toBe(true);
  await waitFor(() => expect(screen.getByLabelText("Game status")).toHaveTextContent("Play paused"));
});
