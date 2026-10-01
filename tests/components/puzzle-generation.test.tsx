import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PuzzleGenerationControls } from "@/components/puzzles/generation-controls";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("starts only on request and guards repeated clicks while generation runs", async () => {
  let resolve!: (response: Response) => void;
  const request = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal("fetch", request);
  render(<PuzzleGenerationControls gameId="game" ready generation={null} />);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Generate puzzles" }));
  fireEvent.click(screen.getByRole("button", { name: "Checking puzzle candidates…" }));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("/api/games/game/puzzles", { method: "POST" });
  resolve(Response.json({ generation: { count: 1 } }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});
it("shows retryable errors and keeps the action available", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Stockfish unavailable." } }, { status: 503 })));
  render(<PuzzleGenerationControls gameId="game" ready generation={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Generate puzzles" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Stockfish unavailable.");
  expect(screen.getByRole("button", { name: "Generate puzzles" })).toBeEnabled();
});
it("explains the empty result and does not offer duplicate generation", () => {
  render(<PuzzleGenerationControls gameId="game" ready generation={{ status: "COMPLETED", error: null, count: 0, checkedCandidates: 2, leaseUntil: null }} />);
  expect(screen.getByRole("status")).toHaveTextContent("No suitable puzzles");
  expect(screen.queryByRole("button", { name: "Generate puzzles" })).not.toBeInTheDocument();
});
it("requires engine results but does not require AI coaching", () => {
  render(<PuzzleGenerationControls gameId="game" ready={false} generation={null} />);
  expect(screen.getByRole("button", { name: "Generate puzzles" })).toBeDisabled();
  expect(screen.getByText(/AI coaching is optional/)).toBeInTheDocument();
});
