import { afterEach, expect, it, vi } from "vitest";
const { listGames, findGame } = vi.hoisted(() => ({ listGames: vi.fn(), findGame: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/games/queries", () => ({ listGames, findGame }));
import { GET as list } from "@/app/api/games/route";
import { GET as detail } from "@/app/api/games/[id]/route";
afterEach(() => vi.resetAllMocks());
const request = () => detail(new Request("http://localhost/api/games/id"), { params: Promise.resolve({ id: "id" }) });
it("returns summarized list and detailed game envelopes", async () => {
  listGames.mockResolvedValue([]);
  expect(await (await list()).json()).toEqual({ games: [] });
  findGame.mockResolvedValue({ id: "id" });
  expect(await (await request()).json()).toEqual({ game: { id: "id" } });
  expect(findGame).toHaveBeenCalledWith({}, "id");
});
it("returns 404 for a missing game", async () => {
  findGame.mockResolvedValue(null);
  const response = await request();
  expect(response.status).toBe(404);
  expect(await response.json()).toHaveProperty("error.code", "GAME_NOT_FOUND");
});
it("sanitizes database failures on both read endpoints", async () => {
  listGames.mockRejectedValue(new Error("secret database URL"));
  findGame.mockRejectedValue(new Error("secret database URL"));
  for (const response of [await list(), await request()]) {
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("READ_FAILED");
    expect(JSON.stringify(body)).not.toContain("secret");
  }
});
