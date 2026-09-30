import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createAuth } from "@/lib/auth/create-auth";
import { resetLocalPassword, claimLegacyGames } from "@/lib/auth/admin";
import { createImportRepository } from "@/lib/games/import-repository";
import { createAnalysisRepository } from "@/lib/analysis/repository";
import { createCoachingRepository } from "@/lib/coaching/repository";
import { getDashboard, findGame } from "@/lib/games/queries";
import { parsePgn } from "@/lib/pgn/parse";
import { assertTestDatabase, createTestDb } from "../support/database";

const db = createTestDb();
const prefix = randomUUID();
const origin = "http://localhost:3099";
const auth = createAuth(db, { BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: "integration-auth-secret-for-isolated-tests-only" });
const password = "correct horse battery staple";
const users: string[] = [];
const games: string[] = [];
const cookies: string[] = [];
const ips: string[] = [];
function request(path: string, body?: unknown, cookie?: string, ip = "192.0.2.29") {
  const headers: Record<string, string> = { origin, "content-type": "application/json", "x-forwarded-for": ip };
  if (cookie) headers.cookie = cookie;
  if (!ips.includes(ip)) ips.push(ip);
  return auth.handler(new Request(`${origin}/api/auth/${path}`, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined }));
}
function sessionCookie(response: Response) { return response.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; "); }
beforeAll(async () => {
  await assertTestDatabase(db);
  for (const suffix of ["a", "b"]) {
    const response = await request("sign-up/email", { name: suffix, email: `${prefix}-${suffix}@example.test`, password });
    expect(response.status).toBe(200);
    const body = await response.json();
    users.push(body.user.id); cookies.push(sessionCookie(response));
  }
});
afterAll(async () => {
  await assertTestDatabase(db);
  await db.game.deleteMany({ where: { id: { in: games } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.rateLimit.deleteMany({ where: { OR: ips.map(ip => ({ key: { contains: ip } })) } });
  await db.$disconnect();
});
it("hashes credentials, preserves stable identity, rejects bad passwords and expires sessions", async () => {
  const account = await db.account.findFirstOrThrow({ where: { userId: users[0], providerId: "credential" } });
  expect(account.accountId).toBe(users[0]); expect(account.password).not.toBe(password);
  expect((await request("sign-in/email", { email: `${prefix}-a@example.test`, password: "wrong password" })).status).toBe(401);
  const login = await request("sign-in/email", { email: `${prefix}-a@example.test`, password });
  expect(login.status).toBe(200);
  const cookie = sessionCookie(login);
  expect(cookie).toContain("session_token");
  expect(login.headers.get("set-cookie")).toMatch(/httponly/i);
  expect(login.headers.get("set-cookie")).toMatch(/samesite=lax/i);
  expect((await (await request("get-session", undefined, cookie)).json()).user.id).toBe(users[0]);
  await db.session.updateMany({ where: { userId: users[0] }, data: { expiresAt: new Date(0) } });
  expect(await (await request("get-session", undefined, cookie)).json()).toBeNull();
});
it("isolates dashboards, detail, engine/coaching reads and claims between users", async () => {
  const game = await createImportRepository(db, users[0]).create(parsePgn("1. e4 e5 *"), "WHITE"); games.push(game.id);
  expect((await getDashboard(db, users[0])).count).toBe(1);
  expect((await getDashboard(db, users[1])).count).toBe(0);
  expect(await findGame(db, game.id, users[1])).toBeNull();
  expect(await findGame(db, game.id, users[0])).not.toBeNull();
  const engine = createAnalysisRepository(db, users[1]);
  expect(await engine.load(game.id)).toBeNull(); expect(await engine.claim(game.id)).toBe(false);
  await db.game.update({ where: { id: game.id }, data: { analysisStatus: "ENGINE_COMPLETED" } });
  const coach = createCoachingRepository(db, undefined, users[1]);
  expect(await coach.load(game.id)).toBeNull(); expect(await coach.claim(game.id)).toBe(false);
  const claimed = createCoachingRepository(db, undefined, users[0]);
  expect(await claimed.claim(game.id)).toBe(true);
  await claimed.fail(game.id, "test cleanup");
});
it("local recovery changes credentials, revokes all sessions and keeps games", async () => {
  const replacement = "another long private passphrase";
  const saved = await createImportRepository(db, users[1]).create(parsePgn("1. d4 d5 *"), "BLACK");
  games.push(saved.id);
  const gameCount = await db.game.count({ where: { ownerId: users[1] } });
  await resetLocalPassword(db, `${prefix}-b@example.test`, replacement);
  expect(await db.session.count({ where: { userId: users[1] } })).toBe(0);
  expect(await (await request("get-session", undefined, cookies[1])).json()).toBeNull();
  expect((await request("sign-in/email", { email: `${prefix}-b@example.test`, password })).status).toBe(401);
  const login = await request("sign-in/email", { email: `${prefix}-b@example.test`, password: replacement });
  expect(login.status).toBe(200);
  expect((await login.json()).user.id).toBe(users[1]);
  expect(await db.game.count({ where: { ownerId: users[1] } })).toBe(gameCount);
  expect((await findGame(db, saved.id, users[1]))?.game.moves).toHaveLength(2);
  const cookie = sessionCookie(login);
  expect((await request("sign-out", {}, cookie)).status).toBe(200);
  expect(await (await request("get-session", undefined, cookie)).json()).toBeNull();
});
it("rejects cross-origin credential requests and throttles repeated failed logins", async () => {
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ email: `${prefix}-a@example.test`, password }) }));
  expect(response.status).toBe(403);
  const statuses = [];
  for (let i = 0; i < 11; i++) statuses.push((await request("sign-in/email", { email: "unknown@example.test", password }, undefined, "192.0.2.30")).status);
  expect(statuses.at(-1)).toBe(429);
});
it("requires an existing explicit owner to migrate legacy data", async () => {
  await expect(claimLegacyGames(db, `${prefix}-missing@example.test`)).rejects.toThrow("Register the target");
});
