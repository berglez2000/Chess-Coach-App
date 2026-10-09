import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3100";
async function signup(context: import("@playwright/test").APIRequestContext, email: string, name: string) {
  const send = () => context.post("/api/auth/sign-up/email", { headers: { origin }, data: { name, email, password: "browser replay passphrase" } });
  let response = await send();
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, (Number(response.headers()["retry-after"]) || 60) * 1000 + 1000));
    response = await send();
  }
  expect(response.status()).toBe(200);
}
for (const color of ["WHITE", "BLACK"] as const) {
  test(`${color}: private fresh sessions, comparison, reload, results and repeat practice`, async ({ page, browser }) => {
    test.setTimeout(150_000);
    if (color === "BLACK") await page.setViewportSize({ width: 390, height: 844 });
    const email = `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`;
    await signup(page.request, email, "Replay tester");
    await page.goto("/replay"); await expect(page.getByRole("button", { name: "Start practice" })).toBeDisabled();
    const fixture = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "tests/support/e2e-puzzles.mts", email, color, "sequence"], { encoding: "utf8" })) as { gameId: string; ids: string[] };
    await page.goto(`/games/${fixture.gameId}`); await page.getByRole("link", { name: "Beat your past self" }).click();
    await page.getByRole("button", { name: "Start practice" }).click(); await expect(page).toHaveURL(/\/replay\/[a-z0-9]+$/);
    const sessionId = page.url().split("/").at(-1)!;
    const initial = (await (await page.request.get(`/api/replay/${sessionId}`)).json()).session;
    expect(initial.comparison).toBeNull(); expect(initial.puzzle.solutionLine).toBeNull(); expect(initial.puzzle.gameId).toBe("");
    await expect(page.getByRole("group", { name: `Puzzle position, ${color === "WHITE" ? "White" : "Black"} at the bottom` })).toBeVisible();
    // Selection order is deterministic but independent of source-ply order.
    const long = initial.puzzle.maxPlayerMoves > 1;
    const moves = long ? color === "WHITE" ? ["e2e4", "g1f3", "f1b5"] : ["e7e5", "b8c6", "a7a6"] : [color === "WHITE" ? "f3e5" : "g8f6"];
    await page.getByLabel("Move coordinates").fill(color === "WHITE" ? "e2e5" : "e7e4"); await page.getByRole("button", { name: "Check move" }).click();
    await expect(page.getByRole("status", { name: "Puzzle feedback" })).toContainText("Illegal move"); await expect(page.getByText("Moves tried: 0")).toBeVisible();
    for (const [index, move] of moves.entries()) {
      await page.getByLabel("Move coordinates").fill(move); await page.getByRole("button", { name: "Check move" }).click();
      if (index < moves.length - 1) { await expect(page.getByRole("status", { name: "Puzzle feedback" })).toContainText("opponent replied"); await page.reload(); await expect(page.getByRole("region", { name: "Your comparison" })).toHaveCount(0); }
    }
    await expect(page.getByRole("region", { name: "Your comparison" })).toBeVisible();
    await page.screenshot({ path: `/tmp/replay-challenge-${color.toLowerCase()}.png`, fullPage: true });
    await expect(page.getByText("You found the improvement first try without hints.")).toBeVisible();
    await page.getByRole("button", { name: "Inspect original move" }).click(); await expect(page.getByRole("img", { name: /Your original move position/ })).toBeVisible();
    await page.reload(); await expect(page.getByRole("region", { name: "Your comparison" })).toBeVisible();
    await page.getByRole("button", { name: "Next challenge" }).click(); await page.getByRole("button", { name: "Reveal solution" }).click();
    await expect(page.getByRole("region", { name: "Your comparison" })).toBeVisible(); await page.getByRole("button", { name: "Finish session" }).click();
    await expect(page.getByRole("heading", { name: "1 of 2 solved first try without hints" })).toBeVisible();
    await expect(page.getByText(/1 revealed · 0 skipped/)).toBeVisible();
    await page.screenshot({ path: `/tmp/replay-${color.toLowerCase()}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Start practice" }).click(); await expect(page).not.toHaveURL(new RegExp(sessionId));
    await expect(page.getByRole("button", { name: "Check move" })).toBeVisible();
    const other = await browser.newContext({ baseURL: origin });
    try {
      expect((await other.request.get(`/api/replay/${sessionId}`)).status()).toBe(401);
      await signup(other.request, `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, "Other");
      expect((await other.request.get(`/api/replay/${sessionId}`)).status()).toBe(404);
      expect((await other.request.post(`/api/replay/${sessionId}`, { headers: { origin }, data: { action: "REVEAL", requestId: randomUUID(), expectedRevision: 0 } })).status()).toBe(404);
    } finally { await other.close(); }
  });
}
