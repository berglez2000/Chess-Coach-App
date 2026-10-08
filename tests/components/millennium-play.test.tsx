import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { PlayWorkspace } from "@/components/play/workspace";
const mock = vi.hoisted(() => ({ message: undefined as undefined | ((value: { kind: string; squares: string }) => void), disconnect: undefined as undefined | (() => void), close: vi.fn(), connect: vi.fn().mockResolvedValue(undefined), queryOnce: vi.fn().mockResolvedValue(undefined), showLedSquares: vi.fn().mockResolvedValue(undefined), clearLeds: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/chesslink/bluetooth", () => ({ browserBluetooth: () => ({}), ChessLinkConnection: class {
  constructor(message: typeof mock.message, disconnect: typeof mock.disconnect) { mock.message = message; mock.disconnect = disconnect; }
  showLedSquares = mock.showLedSquares; clearLeds = mock.clearLeds; closeWithLeds = async () => { mock.clearLeds(); mock.close(); };
  connect = mock.connect; close = mock.close; queryOnce = mock.queryOnce;
} }));
function squares(board: Chess, reversed = false) { const text = board.fen().split(" ")[0].replaceAll("/", "").replace(/\d/g, digit => ".".repeat(Number(digit))); return reversed ? [...text].reverse().join("") : text; }
function report(board: Chess, reversed = false) { act(() => mock.message?.({ kind: "position", squares: squares(board,reversed) })); }
async function mount(color = "WHITE") {
  const fetcher = vi.fn(async (_url, options) => {
    const input = JSON.parse(options.body); const board = new Chess(input.startFen); for (const move of input.moves) board.move(move);
    return Response.json({ fen: board.fen(), move: board.turn() === "w" ? "e2e4" : "e7e5" });
  }); vi.stubGlobal("fetch",fetcher); render(<PlayWorkspace />);
  fireEvent.change(screen.getByLabelText("Move input"), { target: { value: "millennium" } });
  fireEvent.change(screen.getByLabelText("Your color"), { target: { value: color } });
  fireEvent.click(screen.getByRole("button", { name: "Connect Millennium board" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Reconnect Millennium board" })).toBeEnabled());
  return fetcher;
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("isSecureContext",true); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("accepts physical moves once and waits for the exact Stockfish reply before accepting another", async () => {
  const fetcher = await mount(); const board = new Chess(); report(board,true); fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  expect(screen.getByRole("button", { name: "Play move" })).toBeDisabled();
  vi.useFakeTimers(); const lift = new Chess(); lift.remove("e2"); report(lift,true);
  await act(async () => vi.advanceTimersByTimeAsync(900)); expect(fetcher).not.toHaveBeenCalled();
  board.move("e4"); report(board,true); await act(async () => vi.advanceTimersByTimeAsync(400)); report(board,true);
  await act(async () => vi.advanceTimersByTimeAsync(400)); expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Game moves")).toHaveTextContent("e5"); expect(mock.showLedSquares).toHaveBeenCalledWith(["e5","e7"],true); expect(screen.getByLabelText("Game status")).toHaveTextContent("Synchronize");
  const premature = new Chess(board.fen()); premature.move("e5"); premature.move("Nf3"); report(premature,true);
  await act(async () => vi.advanceTimersByTimeAsync(800)); expect(screen.getByLabelText("Game moves")).not.toHaveTextContent("Nf3");
  board.move("e5"); report(board,true); await act(async () => {}); expect(mock.clearLeds).toHaveBeenCalled(); expect(screen.getByLabelText("Physical board status")).toHaveTextContent("Synchronized");
  board.move("Nf3"); report(board,true); await act(async () => vi.advanceTimersByTimeAsync(800)); expect(screen.getByLabelText("Game moves")).toHaveTextContent("Nf3");
});
it("holds a White engine opening until initial synchronization when the user plays Black", async () => {
  const fetcher = await mount("BLACK"); fireEvent.click(screen.getByRole("button", { name: "Start game" })); expect(fetcher).not.toHaveBeenCalled();
  report(new Chess()); await waitFor(() => expect(screen.getByLabelText("Game moves")).toHaveTextContent("e4"));
  expect(screen.getByLabelText("Game status")).toHaveTextContent("Synchronize");
});
it("pauses on disconnect, requires synchronization after reconnect, and releases the connection on mode change", async () => {
  await mount(); const board = new Chess(); report(board); fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  act(() => mock.disconnect?.()); expect(screen.getByLabelText("Game status")).toHaveTextContent("Play paused");
  fireEvent.click(screen.getByRole("button", { name: "Connect Millennium board" })); await waitFor(() => expect(screen.getByRole("button", { name: "Reconnect Millennium board" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Query position" })); await waitFor(() => expect(mock.queryOnce).toHaveBeenCalledWith("S"));
  report(board); fireEvent.click(screen.getByRole("button", { name: "Resume / retry engine" })); expect(screen.getByLabelText("Game status")).toHaveTextContent("Your turn");
  fireEvent.change(screen.getByLabelText("Move input"), { target: { value: "screen" } }); expect(mock.close).toHaveBeenCalled(); expect(screen.queryByLabelText("Physical board status")).not.toBeInTheDocument();
});
it("does not apply a pending physical move to a restarted game", async () => {
  const fetcher = await mount(); const board = new Chess(); report(board); fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  vi.useFakeTimers(); board.move("e4"); report(board); await act(async () => vi.advanceTimersByTimeAsync(400));
  fireEvent.click(screen.getByRole("button", { name: "Restart with these settings" }));
  await act(async () => vi.advanceTimersByTimeAsync(800)); expect(fetcher).not.toHaveBeenCalled(); expect(screen.getByLabelText("Game moves")).toHaveTextContent("No moves yet");
});

it("reports LED failures and offers explicit retry", async () => {
  mock.showLedSquares.mockRejectedValueOnce(new Error("BLE write failed"));
  await mount("BLACK"); report(new Chess()); fireEvent.click(screen.getByRole("button", { name: "Start game" }));
  await waitFor(() => expect(screen.getByLabelText("LED status")).toHaveTextContent("LED output failed"));
  fireEvent.click(screen.getByRole("button", { name: "Retry LED prompt" }));
  await waitFor(() => expect(screen.getByLabelText("LED status")).toHaveTextContent("LED prompt sent"));
  fireEvent.click(screen.getByLabelText("Stockfish LED prompts"));
  await waitFor(() => expect(screen.getByLabelText("LED status")).toHaveTextContent("LED prompts disabled"));
});
