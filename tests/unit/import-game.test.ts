import { afterEach, expect, it, vi } from "vitest";
import { importGame } from "@/lib/games/import-game";
import * as parser from "@/lib/pgn/parse";

const create = vi.fn().mockResolvedValue({ id: "saved-game" });
afterEach(() => { vi.restoreAllMocks(); create.mockClear(); });

it.each(["WHITE", "BLACK"])("saves server-derived moves for %s", async (userColor) => {
  const result = await importGame({ userColor, pgn: "1. e4 e5 *", moves: ["forged"] }, { create });
  expect(result).toMatchObject({ gameId: "saved-game", status: "PENDING", userColor });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ moves: [
    expect.objectContaining({ ply: 1, uci: "e2e4" }), expect.objectContaining({ ply: 2, uci: "e7e5" }),
  ] }), userColor);
});
it.each([undefined, "", "RED", "white"])("rejects invalid color (%#) before storage", async (userColor) => {
  expect(await importGame({ userColor, pgn: "1. e4 *" }, { create })).toMatchObject({ error: { code: "INVALID_INPUT", fields: { userColor: expect.any(String) } } });
  expect(create).not.toHaveBeenCalled();
});
it.each([undefined, "", "   ", "1. e4 e5 2. Bh6 *", "x".repeat(100_001)])("rejects invalid PGN (%#) before storage", async (pgn) => {
  expect(await importGame({ userColor: "WHITE", pgn }, { create })).toMatchObject({ error: { fields: { pgn: expect.any(String) } } });
  expect(create).not.toHaveBeenCalled();
});
it.each([null, [], 3])("rejects non-object input (%#)", async (input) => {
  expect(await importGame(input, { create })).toMatchObject({ error: { code: "INVALID_INPUT" } });
  expect(create).not.toHaveBeenCalled();
});
it("sanitizes unexpected parser and database failures", async () => {
  create.mockRejectedValueOnce(new Error("private database URL"));
  const input = { userColor: "WHITE", pgn: "1. e4 *" };
  const failed = await importGame(input, { create });
  expect(failed).toMatchObject({ error: { code: "IMPORT_FAILED", message: expect.stringContaining("try again") } });
  expect(JSON.stringify(failed)).not.toContain("private");
  vi.spyOn(parser, "parsePgn").mockImplementation(() => { throw new Error("private parser details"); });
  expect(await importGame(input, { create })).toEqual(failed);
});
