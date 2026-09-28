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
it.each(["ENGINE_RUNNING", "AI_RUNNING"] as const)("locks active %s runs and refreshes persisted progress", async status => {
  vi.useFakeTimers();
  const { rerender, unmount } = render(<AnalysisControls gameId="game" status={status} error={null} leaseUntil="2099-01-01T00:00:00.000Z" />);
  expect(screen.getByRole("button", { name: "Analysis in progress…" })).toBeDisabled();
  await act(async () => vi.advanceTimersByTime(2000));
  expect(refresh).toHaveBeenCalled();
  rerender(<AnalysisControls gameId="game" status="COMPLETED" error={null} leaseUntil={null} />);
  expect(screen.getByRole("status")).toHaveTextContent("review is ready");
  refresh.mockClear();
  await act(async () => vi.advanceTimersByTime(4000));
  expect(refresh).not.toHaveBeenCalled();
  unmount(); vi.useRealTimers();
});
it("enables coaching recovery when its lease expires", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  render(<AnalysisControls gameId="game" status="AI_RUNNING" error={null} leaseUntil="2026-09-28T12:00:01Z" />);
  await act(async () => vi.advanceTimersByTime(2000));
  expect(screen.getByRole("button", { name: "Retry coaching" })).toBeEnabled();
  vi.useRealTimers();
});
it("reports a nonfatal coaching failure returned by the combined request", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ coaching: { status: "AI_FAILED", message: "Configure ANTHROPIC_API_KEY. Engine review is available." } })));
  render(<AnalysisControls gameId="game" status="ENGINE_COMPLETED" error={null} leaseUntil={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Retry coaching" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("ANTHROPIC_API_KEY");
});
it("starts an imported game once and consumes the auto-start URL", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ coaching: { status: "COMPLETED" } })));
  const replace = vi.spyOn(window.history, "replaceState");
  const { rerender } = render(<AnalysisControls autoStart gameId="game" status="PENDING" error={null} leaseUntil={null} />);
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  rerender(<AnalysisControls autoStart gameId="game" status="FAILED" error="Engine unavailable" leaseUntil={null} />);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith(window.history.state, "", "/games/game");
  replace.mockRestore();
});
it("only regenerates on explicit action using the displayed revision", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ coaching: { status: "COMPLETED" } }));
  vi.stubGlobal("fetch", fetch);
  render(<AnalysisControls gameId="game" status="COMPLETED" error={null} leaseUntil={null} coachingRevision={7} />);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  fireEvent.click(screen.getByRole("button", { name: "Regenerate coaching" }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/games/game/coaching", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"expectedRevision":7}' });
});
