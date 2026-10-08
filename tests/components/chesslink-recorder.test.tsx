import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { BoardRecorder } from "@/components/chesslink/recorder";
import { recordingChess, type RecordingDraft } from "@/lib/chesslink/recording";
import captured from "@/tests/fixtures/chesslink/m830-1.64-d4-e6-e4-d5.json";
import { ChessLinkDecoder } from "@/lib/chesslink/protocol";

const mock = vi.hoisted(() => ({ message: undefined as undefined | ((value: { kind: string; squares: string }) => void), disconnect: undefined as undefined | ((message: string) => void), diagnostic: undefined as undefined | ((message: string) => void), queryOnce: vi.fn().mockResolvedValue(undefined), close: vi.fn(), connect: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/components/chess/replay-board", () => ({ ReplayBoard: ({ fen }: { fen: string }) => <div data-testid="board">{fen}</div> }));
vi.mock("@/lib/chesslink/bluetooth", () => ({ browserBluetooth: () => ({}), ChessLinkConnection: class {
  constructor(message: typeof mock.message, disconnect: typeof mock.disconnect, diagnostic: typeof mock.diagnostic) { mock.message = message; mock.disconnect = disconnect; mock.diagnostic = diagnostic; }
  connect = mock.connect; close = mock.close; queryOnce = mock.queryOnce;
} }));
const key = "chess-coach:chesslink:alice";
const initial: RecordingDraft = { version: 1, id: "12345678-1234-4234-8234-123456789abc", moves: [], color: "WHITE", rotated: false, player: "Alice", date: "2026-10-08", result: "*", finished: false };
function position(chess: Chess) { return chess.fen().split(" ")[0].replaceAll("/", "").replace(/\d/g, char => ".".repeat(Number(char))); }
async function mount(draft = initial) {
  localStorage.setItem(key, JSON.stringify(draft)); render(<BoardRecorder ownerId="alice" playerName="Alice" />);
  await screen.findByRole("button", { name: "Connect board" });
}
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); vi.stubGlobal("isSecureContext", true);
  mock.connect.mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("requires a matching reported board before recording, confirms moves, and pauses on disconnect", async () => {
  await mount();
  fireEvent.click(screen.getByLabelText("Automatically accept stable legal positions"));
  const start = screen.getByRole("button", { name: "Start recording" }); expect(start).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Reconnect" })).toBeEnabled());
  const chess = new Chess();
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  expect(start).toBeEnabled(); fireEvent.click(start);
  vi.useFakeTimers(); chess.move("e4");
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  await act(async () => { await vi.advanceTimersByTimeAsync(800); });
  const log = screen.getByRole("log", { name: "Board activity" });
  expect(log).toHaveTextContent("e2: P → empty");
  expect(log).toHaveTextContent("e4: empty → P");
  expect(log).toHaveTextContent("Detected e4 (e2e4) — waiting for confirmation.");
  expect(JSON.parse(localStorage.getItem(key)!).moves).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Confirm e2e4" }));
  expect(JSON.parse(localStorage.getItem(key)!).moves).toEqual(["e2e4"]);
  expect(log).toHaveTextContent("Recorded e4 (e2e4), half-move 1.");
  act(() => mock.disconnect?.("Board disconnected."));
  expect(screen.getByRole("button", { name: "Resume recording" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
});
it("logs changes while paused, omits duplicate positions, and supports clearing the log", async () => {
  await mount(); fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await screen.findByRole("button", { name: "Reconnect" });
  const chess = new Chess();
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  const log = screen.getByRole("log", { name: "Board activity" });
  const initialCount = log.children.length;
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  expect(log.children).toHaveLength(initialCount);
  chess.move("e4");
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  expect(log).toHaveTextContent("Legal move e2e4 detected while paused; it was not recorded.");
  expect(JSON.parse(localStorage.getItem(key)!).moves).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Clear activity" }));
  expect(within(log).queryByText(/e2e4/)).not.toBeInTheDocument();
});
it("explains the recording gate separately for missing data, unsupported data and a mismatched position", async () => {
  await mount(); fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await screen.findByRole("button", { name: "Reconnect" });
  expect(screen.getByText(/Bluetooth is connected, but the board has not sent a position/)).toBeInTheDocument();
  act(() => mock.diagnostic?.("RX 80 81"));
  expect(screen.getByText(/Bluetooth data arrived, but no supported board position was decoded/)).toBeInTheDocument();
  const chess = new Chess(); chess.move("e4");
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  expect(screen.getByText(/The reported board position differs from the recorded position/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start recording" })).toBeDisabled();
  act(() => mock.message?.({ kind: "position", squares: position(new Chess()) }));
  expect(screen.getByRole("button", { name: "Start recording" })).toBeEnabled();
});
it("calibrates the user's reversed starting report and keeps that order for subsequent moves", async () => {
  await mount(); fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  fireEvent.click(screen.getByLabelText("Automatically accept stable legal positions"));
  await screen.findByRole("button", { name: "Reconnect" });
  const reversed = "RNBKQBNRPPPPPPPP................................pppppppprnbkqbnr";
  act(() => mock.message?.({ kind: "position", squares: reversed }));
  expect(screen.getByRole("button", { name: "Start recording" })).toBeEnabled();
  expect(screen.getByLabelText("Reverse ChessLink square order")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
  vi.useFakeTimers();
  const chess = new Chess(); chess.move("e4");
  act(() => mock.message?.({ kind: "position", squares: [...position(chess)].reverse().join("") }));
  await act(async () => { await vi.advanceTimersByTimeAsync(800); });
  fireEvent.click(screen.getByRole("button", { name: "Confirm e2e4" }));
  expect(JSON.parse(localStorage.getItem(key)!).moves).toEqual(["e2e4"]);
  expect(screen.getByTestId("board")).toHaveTextContent(chess.fen());
});
it("records the real trace automatically while slow departure/destination presses keep recording active", async () => {
  await mount(); fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await screen.findByRole("button", { name: "Reconnect" });
  const decoder = new ChessLinkDecoder();
  const reports = captured.frames.flatMap(frame => decoder.push(Uint8Array.from(frame.hex.split(" ").map(byte => parseInt(byte, 16))))).filter(event => event.kind === "position");
  act(() => mock.message?.(reports[0]));
  expect(screen.getByLabelText("Automatically accept stable legal positions")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
  vi.useFakeTimers();
  for (const report of reports.slice(1)) {
    act(() => mock.message?.(report));
    // Actual departure presses persisted for 0.959–1.591 seconds, longer than debounce.
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  }
  expect(JSON.parse(localStorage.getItem(key)!).moves).toEqual(captured.expectedMoves);
  expect(screen.getByTestId("board")).toHaveTextContent(recordingChess(captured.expectedMoves).fen());
});
it("recovers the four declared moves without resetting the physical board", async () => {
  await mount({ ...initial, rotated: true });
  fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await screen.findByRole("button", { name: "Reconnect" });
  const chess = recordingChess(captured.expectedMoves);
  act(() => mock.message?.({ kind: "position", squares: [...position(chess)].reverse().join("") }));
  fireEvent.change(screen.getByLabelText("Moves already played"), { target: { value: "1. d4 e6 2. e4 d5" } });
  fireEvent.click(screen.getByRole("button", { name: "Recover played moves" }));
  expect(JSON.parse(localStorage.getItem(key)!).moves).toEqual(captured.expectedMoves);
  expect(screen.getByRole("button", { name: "Resume recording" })).toBeEnabled();
  expect(screen.getByTestId("board")).toHaveTextContent(chess.fen());
});
it("restores the owned draft and preserves a fixed snapshot for save retries", async () => {
  await mount({ ...initial, moves: ["e2e4", "e7e5"], finished: true });
  expect(screen.getByTestId("board")).toHaveTextContent(recordingChess(["e2e4", "e7e5"]).fen());
  const fetch = vi.fn().mockRejectedValueOnce(new Error("network interrupted")).mockResolvedValueOnce({ ok: true, json: async () => ({ gameId: "saved" }) });
  vi.stubGlobal("fetch", fetch);
  fireEvent.click(screen.getByRole("button", { name: "Save to My Games" }));
  await screen.findByText("network interrupted");
  expect(screen.getByLabelText("Your name")).toBeDisabled();
  expect(JSON.parse(localStorage.getItem(key)!).savePgn).toContain("1. e4 e5 *");
  fireEvent.click(screen.getByRole("button", { name: "Save to My Games" }));
  expect(await screen.findByRole("link", { name: /Review and analyze/ })).toHaveAttribute("href", "/games/saved?analyze=1");
  expect(fetch.mock.calls[0][1].body).toEqual(fetch.mock.calls[1][1].body);
  expect(localStorage.getItem(key)).toBeNull();
});
it("keeps corrupt recovery data untouched and never reads another owner's draft", async () => {
  localStorage.setItem(key, "corrupt");
  render(<BoardRecorder ownerId="alice" playerName="Alice" />);
  await screen.findByRole("button", { name: "Download recovery data" });
  expect(localStorage.getItem(key)).toBe("corrupt");
});
it("keeps recording through silent thinking time and accepts the next notification", async () => {
  await mount(); fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await screen.findByRole("button", { name: "Reconnect" });
  const chess = new Chess();
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  vi.useFakeTimers();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(screen.getByRole("button", { name: "Start recording" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  chess.move("e4");
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  await act(async () => { await vi.advanceTimersByTimeAsync(800); });
  expect(JSON.parse(localStorage.getItem(key)!).moves).toEqual(["e2e4"]);
});

it("defaults to listen-only mode and locks it while connected", async () => {
  await mount();
  expect(screen.getByLabelText("Listen only (preserve King LED prompts)")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await screen.findByRole("button", { name: "Reconnect" });
  expect(mock.connect).toHaveBeenCalledWith({}, true);
  expect(screen.getByLabelText("Listen only (preserve King LED prompts)")).toBeDisabled();
});

it("offers independent initialization probes only while paused", async () => {
  await mount(); fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await screen.findByRole("button", { name: "Reconnect" });
  fireEvent.click(screen.getByRole("button", { name: "Query firmware once" }));
  await waitFor(() => expect(mock.queryOnce).toHaveBeenCalledWith("V"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Query position once" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Query position once" }));
  await waitFor(() => expect(mock.queryOnce).toHaveBeenCalledWith("S"));
  act(() => mock.message?.({ kind: "position", squares: position(new Chess()) }));
  fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
  expect(screen.queryByRole("button", { name: "Query position once" })).not.toBeInTheDocument();
});

it("shows the position query when listen-only connects without a report and enables Start only after synchronization", async () => {
  await mount(); fireEvent.click(screen.getByRole("button", { name: "Connect board" }));
  await screen.findByRole("button", { name: "Reconnect" });
  expect(screen.getByText(/Start recording needs a position matching the board shown/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start recording" })).toBeDisabled();
  expect(screen.getByText("Troubleshoot missing move updates").closest("details")).toHaveAttribute("open");
  fireEvent.click(screen.getByRole("button", { name: "Query position once" }));
  await waitFor(() => expect(mock.queryOnce).toHaveBeenCalledWith("S"));
  const chess = new Chess(); chess.move("e4");
  act(() => mock.message?.({ kind: "position", squares: position(chess) }));
  expect(screen.getByRole("button", { name: "Start recording" })).toBeDisabled();
  act(() => mock.message?.({ kind: "position", squares: position(new Chess()) }));
  expect(screen.getByRole("button", { name: "Start recording" })).toBeEnabled();
});
