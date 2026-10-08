import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { afterEach, expect, it, vi } from "vitest";
import { PositionAnalysisPanel } from "@/components/analysis/position-panel";
import { AnalysisWorkspace } from "@/components/analysis/workspace";
import { GameReview } from "@/components/games/game-review";
import { OpeningEditor } from "@/components/openings/editor";
import { OpeningPractice } from "@/components/openings/practice";
import { EMPTY_OPENING } from "@/lib/openings/content";
import { parsePgn } from "@/lib/pgn/parse";
import { positionResult } from "@/lib/position-analysis/contract";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
const initial = { startFen: DEFAULT_POSITION, moves: [] };
function result(fen = DEFAULT_POSITION, move = "e2e4", score = 32) {
  return positionResult(fen, { perspective: new Chess(fen).turn() === "w" ? "WHITE" : "BLACK", bestMove: move,
    evaluation: { depth: 12, score: { kind: "cp", value: score, bound: "exact" }, pv: [move] } });
}
function stream() {
  let output!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { output = controller; } });
  return { response: new Response(body), send(event: unknown) { output.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n")); }, close() { output.close(); } };
}
function play(uci: string) { fireEvent.change(screen.getByLabelText("Move coordinates"), { target: { value: uci } }); fireEvent.click(screen.getByRole("button", { name: "Play move" })); }
it("is opt-in, renders streamed partial depth/score, applies a candidate, and stops the search", async () => {
  const source = stream(); let signal!: AbortSignal; const onPlay = vi.fn();
  const fetcher = vi.fn(async (_url, options) => { signal = options.signal; return source.response; }); vi.stubGlobal("fetch", fetcher);
  render(<PositionAnalysisPanel position={initial} onPlay={onPlay} />);
  expect(fetcher).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Analyze position" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await act(async () => source.send({ type: "progress", result: result() }));
  expect(screen.getByLabelText("Analysis status")).toHaveTextContent("Depth 12 · Partial results"); expect(screen.getByText("+0.32")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Try e4" })); expect(onPlay).toHaveBeenCalledWith(["e2e4"]);
  fireEvent.click(screen.getByRole("button", { name: "Stop analysis" })); expect(signal.aborted).toBe(true);
  expect(screen.getByLabelText("Analysis status")).toHaveTextContent("Analysis stopped");
});
it("clears obsolete results immediately and ignores a superseded response", async () => {
  let resolveOld!: (response: Response) => void; let oldSignal!: AbortSignal;
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => { oldSignal = options.signal; return new Promise<Response>(resolve => { resolveOld = resolve; }); });
  const board = new Chess(); board.move("e4");
  const next = new Response(JSON.stringify({ type: "complete", result: result(board.fen(), "e7e5", 80) }) + "\n"); fetcher.mockResolvedValueOnce(next); vi.stubGlobal("fetch", fetcher);
  const { rerender } = render(<PositionAnalysisPanel position={initial} />); fireEvent.click(screen.getByRole("button", { name: "Analyze position" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  rerender(<PositionAnalysisPanel position={{ ...initial, moves: ["e2e4"] }} />); expect(oldSignal.aborted).toBe(true);
  await act(async () => resolveOld(new Response(JSON.stringify({ type: "complete", result: result() }) + "\n")));
  expect(screen.queryByText("+0.32")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("-0.80")).toBeVisible()); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("preserves partial results on engine interruption and supports explicit retry with a different budget", async () => {
  const first = new Response(JSON.stringify({ type: "progress", result: result() }) + "\n");
  const fetcher = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(new Response(JSON.stringify({ type: "complete", result: result() }) + "\n")); vi.stubGlobal("fetch", fetcher);
  render(<PositionAnalysisPanel position={initial} />); fireEvent.click(screen.getByRole("button", { name: "Analyze position" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("interrupted")); expect(screen.getByText("+0.32")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Analysis thinking time"), { target: { value: "deep" } });
  await waitFor(() => expect(screen.getByLabelText("Analysis status")).toHaveTextContent("Search complete"));
  expect(JSON.parse(fetcher.mock.calls[1][1].body).preset).toBe("deep");
});
it("manually branches both sides, navigates, rejects illegal moves, and validates starting FEN", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); render(<AnalysisWorkspace />);
  play("e2e5"); expect(screen.getByRole("alert")).toHaveTextContent("Illegal move");
  play("e2e4"); play("e7e5"); fireEvent.click(screen.getByRole("button", { name: "Previous" })); play("c7c5");
  expect(screen.getByLabelText("Explored moves")).toHaveTextContent("c5"); expect(screen.getByLabelText("Explored moves")).not.toHaveTextContent("e5");
  fireEvent.click(screen.getByRole("button", { name: "Start" })); expect(screen.getByLabelText("Current FEN")).toHaveTextContent(DEFAULT_POSITION);
  fireEvent.click(screen.getByRole("button", { name: "End" })); expect(screen.getByLabelText("Board status")).toHaveTextContent("White to move");
  fireEvent.click(screen.getByText("Starting position", { exact: true })); fireEvent.change(screen.getByLabelText("Starting FEN"), { target: { value: "bad" } }); fireEvent.click(screen.getByRole("button", { name: "Load position" })); expect(screen.getByRole("alert")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Normal starting position" })); expect(screen.getByLabelText("Current FEN")).toHaveTextContent(DEFAULT_POSITION); expect(fetcher).not.toHaveBeenCalled();
});
it("promotes with the shared picker and respects terminal positions", () => {
  HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };
  render(<AnalysisWorkspace />); fireEvent.click(screen.getByText("Starting position", { exact: true }));
  fireEvent.change(screen.getByLabelText("Starting FEN"), { target: { value: "7k/P7/8/8/8/8/8/7K w - - 0 1" } }); fireEvent.click(screen.getByRole("button", { name: "Load position" }));
  play("a7a8"); expect(screen.getByRole("dialog", { name: "Promote your pawn" })).toBeVisible(); fireEvent.click(screen.getByRole("button", { name: "Promote to knight" }));
  expect(screen.getByLabelText("Board status")).toHaveTextContent("Draw"); play("h8h7"); expect(screen.getByRole("alert")).toHaveTextContent("ended");
});
it("offers opt-in analysis in review/exploration and opening authoring while concealing practice", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const review = render(<GameReview game={parsePgn("1. e4 e5 *")} userColor="BLACK" status="ENGINE_COMPLETED" />);
  fireEvent.click(screen.getByRole("tab", { name: "Engine" })); expect(screen.getByRole("button", { name: "Analyze position" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Explore position" })); expect(screen.getByRole("button", { name: "Analyze position" })).toBeVisible(); expect(fetcher).not.toHaveBeenCalled(); review.unmount();
  const editor = render(<OpeningEditor />); expect(screen.getByRole("button", { name: "Analyze position" })).toBeVisible(); expect(fetcher).not.toHaveBeenCalled(); editor.unmount();
  render(<OpeningPractice content={{ ...EMPTY_OPENING, name: "Private line", lines: [{ name: "Line", moves: ["e2e4", "e7e5"] }] }} />);
  expect(screen.queryByRole("button", { name: "Analyze position" })).not.toBeInTheDocument();
});
it("handles fragmented UTF-8 and many valid updates coalesced into one network chunk", async () => {
  const board = new Chess(); board.move("e4"); const value = result(board.fen(), "e7e5", 32);
  const progress = JSON.stringify({ type: "progress", result: value }) + "\n";
  const bytes = new TextEncoder().encode(progress.repeat(500) + JSON.stringify({ type: "complete", result: value }) + "\n");
  const split = bytes.indexOf(0xe2) + 1; // split the UTF-8 ellipsis in the Black move label
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(output) { output.enqueue(bytes.slice(0, split)); output.enqueue(bytes.slice(split)); output.close(); } }))));
  render(<PositionAnalysisPanel position={{ ...initial, moves: ["e2e4"] }} />); fireEvent.click(screen.getByRole("button", { name: "Analyze position" }));
  await waitFor(() => expect(screen.getByLabelText("Analysis status")).toHaveTextContent("Search complete"));
  expect(screen.getByText("1… e5")).toBeVisible(); expect(screen.getByText("-0.32")).toBeVisible(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
