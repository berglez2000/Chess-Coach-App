import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePgn } from "@/lib/pgn/parse";
import { PgnParseError, type PgnErrorCode } from "@/lib/pgn/error";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/pgn/${name}.pgn`, import.meta.url), "utf8");

function expectError(pgn: string, code: PgnErrorCode) {
  expect(() => parsePgn(pgn)).toThrow(PgnParseError);
  try {
    parsePgn(pgn);
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe("PGN normalization", () => {
  it("preserves input, metadata, and the ordered half-move/position chain", () => {
    const pgn = fixture("complete");
    const game = parsePgn(pgn);
    expect(game.pgn).toBe(pgn);
    expect(game.metadata).toEqual({
      whiteName: "Aljaz", blackName: "Opponent", result: "1-0",
      playedAt: "2026-09-21T00:00:00.000Z", event: "Local rapid",
      site: "https://lichess.org/example", round: "1", openingName: "Ruy Lopez",
      eco: "C60", timeControl: "600+5", termination: null,
    });
    expect(game.initialFen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(game.moves).toHaveLength(10);
    expect(game.moves[0]).toEqual({
      ply: 1, moveNumber: 1, color: "WHITE", san: "e4", uci: "e2e4",
      fenBefore: game.initialFen,
      fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    });
    game.moves.forEach((move, index) => {
      expect(move.ply).toBe(index + 1);
      expect(move.fenBefore).toBe(index ? game.moves[index - 1].fenAfter : game.initialFen);
    });
    expect(game.moves[8]).toMatchObject({
      ply: 9, moveNumber: 5, color: "WHITE", san: "O-O", uci: "e1g1",
      fenAfter: "r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 5",
    });
    expect(game.finalPosition.fen).toBe(game.moves.at(-1)?.fenAfter);
    expect(game.finalPosition.isCheckmate).toBe(false);
    // A decisive result alone does not imply resignation.
    expect(game.metadata.termination).toBeNull();
  });

  it("normalizes promotion UCI and check SAN", () => {
    const game = parsePgn(fixture("promotion"));
    expect(game.initialFen).toBe("7k/P7/8/8/8/8/8/K7 w - - 0 41");
    expect(game.moves[0]).toMatchObject({
      san: "a8=Q+", uci: "a7a8q", moveNumber: 41,
      fenAfter: "Q6k/8/8/8/8/8/8/K7 b - - 0 41",
    });
  });

  it("removes the captured pawn after en passant", () => {
    expect(parsePgn(fixture("en-passant")).moves.at(-1)).toMatchObject({
      san: "exd6", uci: "e5d6",
      fenBefore: "rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3",
      fenAfter: "rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3",
    });
  });

  it("uses FEN turn and full-move number for Black-to-move starts", () => {
    const game = parsePgn(fixture("black-start"));
    expect(game.moves.map(({ ply, moveNumber, color }) => ({ ply, moveNumber, color }))).toEqual([
      { ply: 1, moveNumber: 23, color: "BLACK" },
      { ply: 2, moveNumber: 24, color: "WHITE" },
      { ply: 3, moveNumber: 24, color: "BLACK" },
    ]);
    expect(game.initialFen).toBe("7k/8/8/8/8/8/8/KR6 b - - 0 23");
  });

  it("recognizes checkmate and missing optional headers", () => {
    const game = parsePgn(fixture("checkmate"));
    expect(game.moves.at(-1)?.san).toBe("Qxf7#");
    expect(game.finalPosition.isCheckmate).toBe(true);
    expect(game.metadata).toMatchObject({ result: "1-0", whiteName: null, blackName: null, playedAt: null });
  });

  it("preserves draw results without claiming the board forced the draw", () => {
    const game = parsePgn(fixture("draw"));
    expect(game.metadata.result).toBe("1/2-1/2");
    expect(game.metadata.playedAt).toBeNull();
    expect(game.finalPosition.isDraw).toBe(false);
  });

  it("accepts unfinished games and result-less movetext", () => {
    expect(parsePgn(fixture("unfinished")).metadata.result).toBe("*");
    expect(parsePgn("1. e4 e5").metadata.result).toBe("*");
  });

  it("replays only the main line with comments, NAGs, and nested variations", () => {
    const pgn = fixture("annotated");
    const game = parsePgn(pgn);
    expect(game.pgn).toBe(pgn);
    expect(game.metadata.event).toBe("Comments (and variations)");
    expect(game.moves.map((move) => move.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(game.metadata.result).toBe("*");
  });

  it("preserves a supplied termination reason without inferring one", () => {
    expect(parsePgn('[Termination "resignation"]\n1. e4 e5 1-0').metadata.termination).toBe("resignation");
  });

  it.each(["2026.02.30", "2025.02.29", "????.??.??", "0000.01.01", "2026.13.01"])("makes invalid/partial date %s null", (date) => {
    expect(parsePgn(`[Date "${date}"]\n1. e4 *`).metadata.playedAt).toBeNull();
  });

  it("accepts leap days, BOM and Windows newlines while retaining raw input", () => {
    const pgn = '\uFEFF[Date "2024.02.29"]\r\n\r\n1. e4 *\r\n';
    expect(parsePgn(pgn)).toMatchObject({ pgn, metadata: { playedAt: "2024-02-29T00:00:00.000Z" } });
  });
});

describe("PGN errors", () => {
  it.each(["", " \n ", "*", '[Event "Empty"]'])("rejects input without moves (%#)", (pgn) => expectError(pgn, "EMPTY_PGN"));
  it.each([fixture("illegal"), "gibberish"])("rejects illegal or non-SAN moves (%#)", (pgn) => expectError(pgn, "ILLEGAL_MOVE"));
  it.each([
    '1. e4 {unfinished', '1. e4 (1. d4', '1. e4 )', '[Event "broken]\n1. e4',
    '[SetUp "1"]\n1. e4', '[FEN "invalid"]\n1. e4',
    '[SetUp "1"]\n[FEN "invalid"]\n1. e4',
    '[Result "1-0"]\n1. e4 0-1', '[Result "win"]\n1. e4 *',
    '[Event "A"]\n[Event "B"]\n1. e4 *',
  ])("rejects malformed or inconsistent PGN (%#)", (pgn) => expectError(pgn, "INVALID_PGN"));
  it.each([fixture("multiple"), "1. e4 e5 1-0 1. d4 d5 0-1", "1. e4 * 1. d4", '1. e4\n[Event "Second"]\n1. d4'])("rejects multiple games (%#)", (pgn) => expectError(pgn, "MULTIPLE_GAMES"));
  it("rejects unsupported variants", () => expectError('[Variant "Chess960"]\n1. e4 *', "UNSUPPORTED_PGN"));
});
