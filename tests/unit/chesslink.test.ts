import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { ChessLinkDecoder, queryBytes, ledBytes, clearLedBytes, squaresToPlacement, CHESSLINK_NOTIFY, CHESSLINK_SERVICE } from "@/lib/chesslink/protocol";
import { isIncompleteMove, matchPosition, readDraft, reconstructMoves, recordingChess, recordingPgn, type RecordingDraft } from "@/lib/chesslink/recording";
import captured from "@/tests/fixtures/chesslink/m830-1.64-d4-e6-e4-d5.json";
import { ChessLinkConnection, type LinkCharacteristic, type LinkDevice } from "@/lib/chesslink/bluetooth";
import { parsePgn } from "@/lib/pgn/parse";

function frame(payload: string) {
  const crc = [...payload].reduce((sum, char) => sum ^ char.charCodeAt(0), 0).toString(16).toUpperCase().padStart(2, "0");
  return Uint8Array.from(payload + crc, char => char.charCodeAt(0) | 128);
}
const squares = (fen: string) => fen.split(" ")[0].replaceAll("/", "").replace(/\d/g, digit => ".".repeat(Number(digit)));
const initial = squares(new Chess().fen());
const draft: RecordingDraft = { version: 1, id: "12345678-1234-4234-8234-123456789abc", moves: ["e2e4", "e7e5"], color: "BLACK", rotated: false, player: 'A "name"', date: "2026-10-08", result: "*", finished: true };

describe("ChessLink protocol", () => {
  it("encodes read-only queries with XOR and odd parity", () => {
    expect([...queryBytes("V")]).toEqual([0xd6, 0xb5, 0xb6]);
    expect([...queryBytes("S")]).toEqual([0xd3, 0xb5, 0xb3]);
  });
  it("decodes fragmented and coalesced notifications", () => {
    const decoder = new ChessLinkDecoder();
    const position = frame(`s${initial}`);
    expect(decoder.push(position.slice(0, 19))).toEqual([]);
    expect(decoder.push(new Uint8Array([...position.slice(19), ...frame("v0104"), ...position])))
      .toEqual([{ kind: "position", squares: initial }, { kind: "version", version: "1.4" }, { kind: "position", squares: initial }]);
  });
  it("rejects bad checksums and unsupported piece codes and recovers", () => {
    const decoder = new ChessLinkDecoder();
    const corrupt = frame(`s${initial}`); corrupt[65] = 48;
    const messages = decoder.push(new Uint8Array([...corrupt, ...frame(`s${"?".repeat(64)}`), ...frame(`s${initial}`)]));
    expect(messages).toEqual([{ kind: "position", squares: initial }]);
    expect(decoder.rejectedFrames).toBeGreaterThan(0);
  });
  it("maps standard and rotated order without swapping colors", () => {
    expect(squaresToPlacement(initial)).toBe(new Chess().fen().split(" ")[0]);
    expect(squaresToPlacement([...initial].reverse().join(""), true)).toBe(squaresToPlacement(initial));
  });
});

describe("legal recording", () => {
  it("replays the user's actual pressure-board frames without treating departure presses as errors", () => {
    const decoder = new ChessLinkDecoder(); const moves: string[] = []; let incomplete = 0;
    for (const frame of captured.frames) {
      const bytes = Uint8Array.from(frame.hex.split(" ").map(byte => parseInt(byte, 16)));
      for (const event of decoder.push(bytes)) {
        if (event.kind !== "position") continue;
        const placement = squaresToPlacement(event.squares, true);
        const match = matchPosition(moves, placement);
        if (match.kind === "move") moves.push(match.uci);
        else if (match.kind === "mismatch") { expect(isIncompleteMove(moves, placement)).toBe(true); incomplete++; }
        else expect(match.kind).toBe("same");
      }
    }
    expect(moves).toEqual(captured.expectedMoves); expect(incomplete).toBe(4);
    expect(decoder.rejectedFrames).toBe(0);
  });
  it("recovers user-supplied move text only when the final position agrees", () => {
    const expected = recordingChess(captured.expectedMoves).fen().split(" ")[0];
    expect(reconstructMoves("1. d4 e6 2. e4 d5", expected)).toEqual(captured.expectedMoves);
    expect(() => reconstructMoves("1. d4 e6", expected)).toThrow("do not reach");
    expect(() => reconstructMoves("1. d5", expected)).toThrow("legal move");
  });
  it("deduplicates positions and refuses to infer missed moves", () => {
    const chess = recordingChess(draft.moves);
    expect(matchPosition(draft.moves, chess.fen().split(" ")[0])).toEqual({ kind: "same" });
    chess.move("Nf3");
    expect(matchPosition(draft.moves, chess.fen().split(" ")[0])).toEqual({ kind: "move", uci: "g1f3" });
    chess.move("Nc6");
    expect(matchPosition(draft.moves, chess.fen().split(" ")[0])).toEqual({ kind: "mismatch" });
    expect(matchPosition(draft.moves, new Chess().fen().split(" ")[0])).toEqual({ kind: "takeback", ply: 0 });
  });
  it.each([
    ["e4 e5 Nf3 Nc6 Bc4 Nf6", "O-O", "e1g1"],
    ["e4 a6 e5 d5", "exd6", "e5d6"],
    ["a4 h5 a5 h4 a6 h3 axb7 hxg2", "bxa8=N", "b7a8n"],
  ])("matches special moves (%s)", (line, san, uci) => {
    const chess = new Chess(); line.split(" ").forEach(move => chess.move(move));
    const moves = chess.history({ verbose: true }).map(move => move.from + move.to + (move.promotion ?? ""));
    chess.move(san);
    expect(matchPosition(moves, chess.fen().split(" ")[0])).toEqual({ kind: "move", uci });
  });
  it("exports a valid unfinished PGN with the correct King color", () => {
    const parsed = parsePgn(recordingPgn(draft));
    expect(parsed.moves.map(move => move.uci)).toEqual(draft.moves);
    expect(parsed.metadata).toMatchObject({ whiteName: "The King Performance", blackName: "A name", result: "*" });
  });
  it("validates recovered drafts and immutable save snapshots", () => {
    expect(readDraft(JSON.stringify(draft))).toEqual(draft);
    expect(readDraft(JSON.stringify({ ...draft, savePgn: recordingPgn(draft) })).savePgn).toBe(recordingPgn(draft));
    expect(() => readDraft(JSON.stringify({ ...draft, moves: ["e2e5"] }))).toThrow();
    expect(() => readDraft(JSON.stringify({ ...draft, savePgn: "1. d4 *" }))).toThrow();
  });
});

describe("Bluetooth lifecycle", () => {
  function hardware() {
    const notify = Object.assign(new EventTarget(), { startNotifications: vi.fn().mockResolvedValue(undefined), value: undefined }) as unknown as LinkCharacteristic;
    const write = Object.assign(new EventTarget(), { writeValueWithResponse: vi.fn().mockResolvedValue(undefined) }) as unknown as LinkCharacteristic;
    const service = { getCharacteristic: vi.fn(async (uuid: string) => uuid === CHESSLINK_NOTIFY ? notify : write) };
    const gatt = { connected: true, connect: vi.fn(), disconnect: vi.fn(), getPrimaryService: vi.fn(async () => service) };
    gatt.connect.mockResolvedValue(gatt);
    const device = Object.assign(new EventTarget(), { gatt }) as LinkDevice;
    return { notify, write, device, gatt, service, access: { requestDevice: vi.fn(async () => device) } };
  }
  it("queries once, receives unsolicited positions without further writes, and cleans up", async () => {
    vi.useFakeTimers();
    try {
      const h = hardware(); const received = vi.fn(); const disconnected = vi.fn();
      const link = new ChessLinkConnection(received, disconnected, vi.fn());
      await link.connect(h.access, false);
      expect(h.gatt.getPrimaryService).toHaveBeenCalledWith(CHESSLINK_SERVICE);
      expect(h.write.writeValueWithResponse).toHaveBeenCalledWith(queryBytes("V"));
      await vi.advanceTimersByTimeAsync(200);
      expect(h.write.writeValueWithResponse).toHaveBeenLastCalledWith(queryBytes("S"));
      h.notify.value = new DataView(frame(`s${initial}`).buffer);
      h.notify.dispatchEvent(new Event("characteristicvaluechanged"));
      expect(received).toHaveBeenCalledWith({ kind: "position", squares: initial });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(h.write.writeValueWithResponse).toHaveBeenCalledTimes(2);
      h.device.dispatchEvent(new Event("gattserverdisconnected"));
      expect(disconnected).toHaveBeenCalledOnce();
      const count = vi.mocked(h.write.writeValueWithResponse).mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      h.notify.dispatchEvent(new Event("characteristicvaluechanged"));
      expect(h.write.writeValueWithResponse).toHaveBeenCalledTimes(count);
      expect(received).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it("receives positions in listen-only mode without accessing the command characteristic", async () => {
    vi.useFakeTimers();
    try {
      const h = hardware(); const received = vi.fn();
      const link = new ChessLinkConnection(received, vi.fn(), vi.fn());
      await link.connect(h.access);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(h.write.writeValueWithResponse).not.toHaveBeenCalled();
      expect(h.service.getCharacteristic).toHaveBeenCalledTimes(1);
      expect(h.service.getCharacteristic).toHaveBeenCalledWith(CHESSLINK_NOTIFY);
      h.notify.value = new DataView(frame(`s${initial}`).buffer);
      h.notify.dispatchEvent(new Event("characteristicvaluechanged"));
      expect(received).toHaveBeenCalledWith({ kind: "position", squares: initial });
      link.close();
    } finally { vi.useRealTimers(); }
  });
  it("isolates explicit one-shot queries in listen-only mode", async () => {
    const h = hardware();
    const link = new ChessLinkConnection(vi.fn(), vi.fn(), vi.fn());
    await link.connect(h.access);
    expect(h.write.writeValueWithResponse).not.toHaveBeenCalled();
    await link.queryOnce("V");
    expect(h.write.writeValueWithResponse).toHaveBeenCalledExactlyOnceWith(queryBytes("V"));
    await link.queryOnce("S");
    expect(h.write.writeValueWithResponse).toHaveBeenCalledTimes(2);
    expect(h.write.writeValueWithResponse).toHaveBeenLastCalledWith(queryBytes("S"));
    link.close();
    await expect(link.queryOnce("S")).rejects.toThrow("Connect the board");
  });
  it("serializes fragmented LED commands with queries and clears only app-owned prompts", async () => {
    const h = hardware(); const link = new ChessLinkConnection(vi.fn(), vi.fn(), vi.fn());
    await link.connect(h.access);
    await link.clearLeds(); expect(h.write.writeValueWithResponse).not.toHaveBeenCalled();
    const output = link.showLedSquares(["e7", "e5"], true); const query = link.queryOnce("S");
    await Promise.all([output,query]);
    const packets = vi.mocked(h.write.writeValueWithResponse).mock.calls.map(call => call[0]);
    expect(packets.slice(0,-1).every(packet => packet.length <= 20)).toBe(true);
    expect([...Buffer.concat(packets.slice(0,-1))]).toEqual([...ledBytes(["e7","e5"],true)]);
    expect(packets.at(-1)).toEqual(queryBytes("S"));
    await link.closeWithLeds(); expect(h.write.writeValueWithResponse).toHaveBeenLastCalledWith(clearLedBytes()); expect(h.gatt.disconnect).toHaveBeenCalled();
  });
  it("drops remaining LED chunks and queued commands when disconnected", async () => {
    const h = hardware(); const link = new ChessLinkConnection(vi.fn(),vi.fn(),vi.fn()); await link.connect(h.access);
    let finish!: () => void;
    vi.mocked(h.write.writeValueWithResponse).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const pending = link.showLedSquares(["a8"]); const queued = link.queryOnce("S");
    await vi.waitFor(() => expect(finish).toBeDefined()); link.close(); finish(); await Promise.all([pending,queued]);
    expect(h.write.writeValueWithResponse).toHaveBeenCalledTimes(1);
  });
  it("cleans up after subscription fails", async () => {
    const h = hardware(); vi.mocked(h.notify.startNotifications).mockRejectedValue(new Error("BLE failure"));
    const link = new ChessLinkConnection(vi.fn(), vi.fn(), vi.fn());
    await expect(link.connect(h.access)).rejects.toThrow("BLE failure");
    expect(h.gatt.disconnect).toHaveBeenCalled();
  });
});

describe("LED framing", () => {
  const text = (bytes: Uint8Array) => [...bytes].map(byte => String.fromCharCode(byte & 127)).join("");
  it.each([false,true])("maps four corner LEDs with checksum and odd parity (reverse=%s)", reverse => {
    const bytes = ledBytes(["a8"],reverse); const command = text(bytes);
    expect(command).toHaveLength(167); expect(command.slice(0,3)).toBe("L20");
    const lit = Array.from({ length:81 },(_,index) => command.slice(3+index*2,5+index*2) !== "00" ? index : -1).filter(index => index >= 0);
    expect(lit).toEqual(reverse ? [70,71,79,80] : [0,1,9,10]);
    expect(command.slice(-2)).toBe([...command.slice(0,-2)].reduce((sum,char) => sum ^ char.charCodeAt(0),0).toString(16).toUpperCase().padStart(2,"0"));
    expect([...bytes].every(byte => byte.toString(2).replaceAll("0","").length % 2 === 1)).toBe(true);
    expect(text(clearLedBytes())).toBe("X58");
  });
  it("rejects invalid squares without constructing hardware commands", () => { expect(() => ledBytes(["a9"])).toThrow(); });
});
