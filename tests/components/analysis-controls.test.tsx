import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { AnalysisControls } from "@/components/games/analysis-controls";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("disables repeated submission and refreshes after completion", async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal("fetch", fetch);
  render(<AnalysisControls gameId="game" status="PENDING" error={null} leaseUntil={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Analyze game" }));
  expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  await act(async () => resolve(Response.json({ status: "ENGINE_COMPLETED" })));
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/games/game/analyze", { method: "POST" });
  expect(refresh).toHaveBeenCalledOnce();
});
it("offers retry after engine failure and retains a safe response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "Engine failed. Please retry." } }, { status: 500 })));
  render(<AnalysisControls gameId="game" status="FAILED" error="Saved failure" leaseUntil={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Retry analysis" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Engine failed");
  expect(screen.getByRole("button", { name: "Retry analysis" })).toBeEnabled();
});
it("shows recovery information for a running game and no run button when complete", () => {
  const { rerender } = render(<AnalysisControls gameId="game" status="ENGINE_RUNNING" error={null} leaseUntil="2026-09-22T10:00:00.000Z" />);
  expect(screen.getByText(/until 2026-09-22/)).toBeVisible();
  rerender(<AnalysisControls gameId="game" status="ENGINE_COMPLETED" error={null} leaseUntil={null} />);
  expect(screen.queryByRole("button", { name: "Retry analysis" })).toBeNull();
});
it("checks persisted status after a transport failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private")));
  render(<AnalysisControls gameId="game" status="PENDING" error={null} leaseUntil={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Analyze game" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});
