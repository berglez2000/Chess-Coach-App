import { afterEach, expect, it, vi } from "vitest";
const { create, getDb } = vi.hoisted(() => ({ create: vi.fn(), getDb: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb }));
import { POST } from "@/app/api/games/route";
afterEach(() => vi.resetAllMocks());
const request = (body: string) => new Request("http://localhost/api/games", { method: "POST", body });
it.each(["{", "null", JSON.stringify({ userColor: "RED", pgn: "1. e4 *" }), JSON.stringify({ userColor: "WHITE", pgn: "1. e5 *" })])("returns 400 without connecting for invalid input (%#)", async (body) => {
  const response = await POST(request(body));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { code: expect.any(String), message: expect.any(String) } });
  expect(getDb).not.toHaveBeenCalled();
});
it("returns 201 and the saved ID with PENDING status", async () => {
  getDb.mockReturnValue({ game: { create } });
  create.mockResolvedValue({ id: "saved-id" });
  const response = await POST(request(JSON.stringify({ userColor: "BLACK", pgn: "1. e4 *" })));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ gameId: "saved-id", status: "PENDING", userColor: "BLACK" });
});
it("sanitizes database configuration failure as 500", async () => {
  getDb.mockImplementation(() => { throw new Error("secret URL"); });
  const response = await POST(request(JSON.stringify({ userColor: "WHITE", pgn: "1. e4 *" })));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: { code: "IMPORT_FAILED", message: "Could not save your game. Your input is still here; please try again." } });
});
