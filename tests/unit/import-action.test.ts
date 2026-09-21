import { afterEach, describe, expect, it, vi } from "vitest";
import { importGame } from "@/app/games/new/actions";
import * as parser from "@/lib/pgn/parse";

function request(color: unknown, pgn: unknown) {
  const data = new FormData();
  if (color !== undefined) data.set("userColor", color as string);
  if (pgn !== undefined) data.set("pgn", pgn as string);
  return data;
}

afterEach(() => vi.restoreAllMocks());

describe("server import action", () => {
  it.each(["WHITE", "BLACK"])("returns server-derived moves and %s color", async (color) => {
    const data = request(color, "1. e4 e5 *");
    data.set("fenBefore", "forged position");
    const result = await importGame(data);
    expect(result).toMatchObject({ status: "success", userColor: color, game: {
      pgn: "1. e4 e5 *", moves: [
        { ply: 1, san: "e4", uci: "e2e4" }, { ply: 2, san: "e5", uci: "e7e5" },
      ],
    } });
    if (result.status === "success") expect(result.game.initialFen).not.toBe("forged position");
  });

  it.each([undefined, "", "RED", "white"])("rejects missing/invalid color (%#)", async (color) => {
    expect(await importGame(request(color, "1. e4 *"))).toMatchObject({
      status: "error", fields: { userColor: "Select White or Black." },
    });
  });

  it.each([undefined, "", "   ", "1. e4 e5 2. Bh6 *", "x".repeat(100_001)])("rejects invalid PGN independently of browser validation (%#)", async (pgn) => {
    expect(await importGame(request("WHITE", pgn))).toMatchObject({
      status: "error", fields: { pgn: expect.any(String) },
    });
  });

  it("rejects uploaded files in text fields", async () => {
    expect(await importGame(request(new File(["WHITE"], "color.txt"), new File(["1. e4 *"], "game.pgn")))).toMatchObject({
      status: "error", fields: { userColor: expect.any(String), pgn: expect.any(String) },
    });
  });

  it("sanitizes unexpected parser failures", async () => {
    vi.spyOn(parser, "parsePgn").mockImplementation(() => { throw new Error("private internal details"); });
    expect(await importGame(request("WHITE", "1. e4 *"))).toEqual({
      status: "error", message: "Import failed unexpectedly. Please try again.",
    });
  });
});
