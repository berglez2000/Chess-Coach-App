import { Chess } from "chess.js";
import type { GameResult, ParsedGame } from "@/types/game";
import { PgnParseError } from "./error";
import { mainlineText } from "./mainline";

const results = new Set<string>(["1-0", "0-1", "1/2-1/2", "*"]);

function optional(value: string | undefined): string | null {
  const text = value?.trim();
  return text && text !== "?" ? text : null;
}

function playedAt(value: string | undefined): string | null {
  if (!value || !/^\d{4}\.\d{2}\.\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split(".").map(Number);
  if (year < 1) return null;
  const date = new Date(`${value.replaceAll(".", "-")}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString() : null;
}

export function parsePgn(input: string): ParsedGame {
  if (typeof input !== "string" || !input.trim()) {
    throw new PgnParseError("EMPTY_PGN", "Paste a PGN containing at least one move.");
  }
  const source = input.replace(/^\uFEFF/, "").trim();
  let remaining = mainlineText(source).trim();
  const headers: Record<string, string> = Object.create(null);
  const tag = /^\[\s*([A-Za-z]+)\s+"([^"\r\n]*)"\s*\]\s*/;
  while (remaining.startsWith("[")) {
    const match = tag.exec(remaining);
    if (!match) throw new PgnParseError("INVALID_PGN", "PGN contains a malformed header.");
    if (Object.hasOwn(headers, match[1])) {
      throw new PgnParseError("INVALID_PGN", "PGN contains a repeated header; import only one game.");
    }
    headers[match[1]] = match[2];
    remaining = remaining.slice(match[0].length);
  }
  if (remaining.includes("[")) {
    throw new PgnParseError("MULTIPLE_GAMES", "Import one game at a time; another header appears after the moves.");
  }
  const markers = [...remaining.matchAll(/1\/2-1\/2|1-0|0-1|\*/g)];
  if (markers.length > 1 || (markers.length === 1 && remaining.slice(markers[0].index! + markers[0][0].length).trim())) {
    throw new PgnParseError("MULTIPLE_GAMES", "Import one game at a time; movetext continues after the result.");
  }
  if (headers.Result && !results.has(headers.Result)) {
    throw new PgnParseError("INVALID_PGN", "PGN Result must be 1-0, 0-1, 1/2-1/2, or *.");
  }
  if (headers.Result && markers[0] && headers.Result !== markers[0][0]) {
    throw new PgnParseError("INVALID_PGN", "PGN Result header and final result marker disagree.");
  }
  if (headers.Variant && !["standard", "chess"].includes(headers.Variant.toLowerCase())) {
    throw new PgnParseError("UNSUPPORTED_PGN", "Only standard chess PGNs are supported.");
  }
  if ((headers.SetUp && !["0", "1"].includes(headers.SetUp)) ||
      (headers.SetUp === "1" && !headers.FEN) ||
      (headers.FEN && headers.SetUp !== "1")) {
    throw new PgnParseError("INVALID_PGN", 'A custom starting position requires both SetUp "1" and a valid FEN header.');
  }

  const chess = new Chess();
  try {
    chess.loadPgn(source, { strict: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid move in PGN:")) {
      throw new PgnParseError("ILLEGAL_MOVE", "PGN contains an illegal or unsupported move. Check the main-line SAN notation.");
    }
    throw new PgnParseError("INVALID_PGN", "PGN could not be parsed. Check its headers, starting position, and movetext.");
  }
  const history = chess.history({ verbose: true });
  if (!history.length) throw new PgnParseError("EMPTY_PGN", "PGN must contain at least one move.");
  if (history.some((move) => move.san === "--")) {
    throw new PgnParseError("UNSUPPORTED_PGN", "Analysis null moves are not supported in a game PGN.");
  }
  return {
    pgn: input,
    initialFen: history[0].before,
    metadata: {
      whiteName: optional(headers.White), blackName: optional(headers.Black),
      result: (markers[0]?.[0] ?? headers.Result ?? "*") as GameResult,
      playedAt: playedAt(headers.Date), event: optional(headers.Event),
      site: optional(headers.Site), round: optional(headers.Round),
      openingName: optional(headers.Opening), eco: optional(headers.ECO),
      timeControl: optional(headers.TimeControl), termination: optional(headers.Termination),
    },
    moves: history.map((move, index) => ({
      ply: index + 1,
      moveNumber: Number(move.before.split(" ")[5]),
      color: move.color === "w" ? "WHITE" : "BLACK",
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      fenBefore: move.before,
      fenAfter: move.after,
    })),
    finalPosition: {
      fen: chess.fen(), isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(), isDraw: chess.isDraw(),
    },
  };
}
