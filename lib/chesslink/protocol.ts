// Independent implementation of the documented Magic Chessboard protocol:
// https://github.com/domschl/python-mchess/blob/main/mchess/magic-board.md
export const CHESSLINK_SERVICE = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
export const CHESSLINK_NOTIFY = "49535343-1e4d-4bd9-ba61-23c647249616";
export const CHESSLINK_WRITE = "49535343-8841-43f4-a8d4-ecbe34729bb3";

function checksum(text: string) {
  return [...text].reduce((sum, character) => sum ^ character.charCodeAt(0), 0)
    .toString(16).toUpperCase().padStart(2, "0");
}

function commandBytes(command: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(command + checksum(command), character => {
    const ascii = character.charCodeAt(0);
    let ones = 0;
    for (let bits = ascii; bits; bits >>= 1) ones += bits & 1;
    return ascii | (ones % 2 === 0 ? 128 : 0);
  });
}

// Only status/version and volatile LED output are exposed; no reset or EEPROM writes.
export function queryBytes(command: "S" | "V") { return commandBytes(command); }
export function clearLedBytes() { return commandBytes("X"); }
export function ledBytes(squares: string[], reversed = false) {
  if (squares.length > 64 || squares.some(square => !/^[a-h][1-8]$/.test(square))) throw new Error("Invalid LED squares.");
  const leds = Array<number>(81).fill(0);
  for (const square of squares) {
    let file = square.charCodeAt(0) - 97; let rank = 8 - Number(square[1]);
    if (reversed) { file = 7 - file; rank = 7 - rank; }
    // Nine LEDs per file, from the A8 corner toward A1. Each square has four corners.
    for (const index of [file * 9 + rank, file * 9 + rank + 1, (file + 1) * 9 + rank, (file + 1) * 9 + rank + 1]) leds[index] = 0x0f;
  }
  return commandBytes("L20" + leds.map(value => value.toString(16).toUpperCase().padStart(2,"0")).join(""));
}

export type BoardMessage = { kind: "position"; squares: string } | { kind: "version"; version: string };

export class ChessLinkDecoder {
  private buffer = "";
  private invalid = 0;
  get rejectedFrames() { return this.invalid; }

  push(bytes: Uint8Array): BoardMessage[] {
    this.buffer += Array.from(bytes, byte => String.fromCharCode(byte & 127)).join("");
    const messages: BoardMessage[] = [];
    const lengths: Record<string, number> = { s: 67, v: 7, l: 3, x: 3, w: 7, r: 7 };
    while (this.buffer.length) {
      const length = lengths[this.buffer[0]];
      if (!length) { this.buffer = this.buffer.slice(1); this.invalid++; continue; }
      if (this.buffer.length < length) break;
      const frame = this.buffer.slice(0, length);
      if (checksum(frame.slice(0, -2)) !== frame.slice(-2).toUpperCase()) {
        this.buffer = this.buffer.slice(1); this.invalid++; continue;
      }
      this.buffer = this.buffer.slice(length);
      if (frame[0] === "s") {
        const squares = frame.slice(1, 65);
        if (/^[PNBRQKpnbrqk.]{64}$/.test(squares)) messages.push({ kind: "position", squares });
        else this.invalid++;
      } else if (frame[0] === "v" && /^[0-9a-f]{4}$/i.test(frame.slice(1, 5))) {
        messages.push({ kind: "version", version: `${parseInt(frame.slice(1, 3), 16)}.${parseInt(frame.slice(3, 5), 16)}` });
      }
    }
    return messages;
  }
}

export function squaresToPlacement(squares: string, rotated = false): string {
  if (!/^[PNBRQKpnbrqk.]{64}$/.test(squares)) throw new Error("Invalid board status.");
  const oriented = rotated ? [...squares].reverse().join("") : squares;
  return Array.from({ length: 8 }, (_, rank) => oriented.slice(rank * 8, rank * 8 + 8)
    .replace(/\.+/g, run => String(run.length))).join("/");
}
