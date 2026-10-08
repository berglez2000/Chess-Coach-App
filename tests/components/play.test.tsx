import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { afterEach, expect, it, vi } from "vitest";
import { PlayWorkspace } from "@/components/play/workspace";
afterEach(() => vi.unstubAllGlobals());
function play(move: string) { fireEvent.change(screen.getByLabelText("Move coordinates"), { target: { value: move } }); fireEvent.click(screen.getByRole("button", { name: "Play move" })); }
function setup() {
  const fetcher = vi.fn(async (_url, options) => {
    const input = JSON.parse(options.body); const board = new Chess(input.startFen); for (const move of input.moves) board.move(move);
    return Response.json({ fen: board.fen(), move: board.turn() === "w" ? "e2e4" : "e7e5" });
  }); vi.stubGlobal("fetch", fetcher); render(<PlayWorkspace />); return fetcher;
}
it("plays only the human side, rejects illegal moves, receives one engine reply, and resigns", async () => {
  const fetcher = setup(); expect(fetcher).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  play("e2e5"); expect(screen.getByRole("alert")).toHaveTextContent("Illegal move"); expect(fetcher).not.toHaveBeenCalled();
  play("e2e4"); await waitFor(() => expect(screen.getByLabelText("Game moves")).toHaveTextContent("e5")); expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).moves).toEqual(["e2e4"]);
  fireEvent.click(screen.getByRole("button", { name: "Resign" })); expect(screen.getByLabelText("Game status")).toHaveTextContent("Resigned · 0-1"); expect(screen.getByRole("button", { name: "Play move" })).toBeDisabled();
});
it("automatically plays White when the human chooses Black and keeps settings fixed for the current game", async () => {
  const fetcher = setup(); fireEvent.change(screen.getByLabelText("Your color"), { target: { value: "BLACK" } }); fireEvent.change(screen.getByLabelText("Difficulty"), { target: { value: "strong" } }); fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  await waitFor(() => expect(screen.getByLabelText("Game moves")).toHaveTextContent("e4")); expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ color: "BLACK", difficulty: "strong" });
  expect(screen.getByLabelText("Game status")).toHaveTextContent("Your turn");
});
it("preserves failed positions and explicitly retries the engine", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: { message: "Engine unavailable" } }, { status: 503 })).mockResolvedValueOnce(Response.json({ fen: DEFAULT_POSITION, move: "e2e4" })); vi.stubGlobal("fetch", fetcher); render(<PlayWorkspace />);
  fireEvent.change(screen.getByLabelText("Your color"), { target: { value: "BLACK" } }); fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Engine unavailable")); expect(screen.getByLabelText("Game moves")).toHaveTextContent("No moves yet");
  fireEvent.click(screen.getByRole("button", { name: "Resume / retry engine" })); await waitFor(() => expect(screen.getByLabelText("Game moves")).toHaveTextContent("e4"));
});
it("fences a late response after restart", async () => {
  let resolve!: (response: Response) => void; let signal!: AbortSignal;
  vi.stubGlobal("fetch", vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(done => { resolve = done; }); })); render(<PlayWorkspace />);
  fireEvent.change(screen.getByLabelText("Your color"), { target: { value: "BLACK" } }); fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  await waitFor(() => expect(resolve).toBeDefined()); fireEvent.change(screen.getByLabelText("Your color"), { target: { value: "WHITE" } }); fireEvent.click(screen.getByRole("button", { name: "Restart with these settings" }));
  expect(signal.aborted).toBe(true); await act(async () => resolve(Response.json({ fen: DEFAULT_POSITION, move: "e2e4" })));
  expect(screen.getByLabelText("Game moves")).toHaveTextContent("No moves yet"); expect(screen.getByLabelText("Game status")).toHaveTextContent("Your turn");
});
it("loads custom starts, offers underpromotion, and ends a drawn game without an engine request", () => {
  const fetcher = setup(); HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };
  fireEvent.change(screen.getByLabelText("Starting FEN"), { target: { value: "7k/P7/8/8/8/8/8/7K w - - 0 1" } }); fireEvent.click(screen.getByRole("button", { name: "Start game" })); play("a7a8");
  fireEvent.click(screen.getByRole("button", { name: "Promote to knight" })); expect(screen.getByLabelText("Game status")).toHaveTextContent("Draw · 1/2-1/2"); expect(fetcher).not.toHaveBeenCalled();
});
it("pauses play for explicit analysis assistance and conceals suggestions initially", () => {
  setup(); fireEvent.click(screen.getByRole("button", { name: "Start game" })); expect(screen.queryByRole("button", { name: "Analyze position" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show analysis assistance" })); expect(screen.getByLabelText("Game status")).toHaveTextContent("Play paused"); expect(screen.getByRole("button", { name: "Play move" })).toBeDisabled(); expect(screen.getByRole("button", { name: "Analyze position" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close analysis" })); expect(screen.getByRole("button", { name: "Play move" })).toBeEnabled();
});
