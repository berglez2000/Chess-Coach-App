import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3100";
for (const width of [1200,390]) test(`Stockfish play at ${width}px`, async ({ page, browser }) => {
  test.setTimeout(120000); await page.setViewportSize({ width, height: 900 });
  const email = `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`;
  await expect.poll(async () => (await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Play tester", email, password: "stockfish browser passphrase" } })).status(), { timeout: 65000, intervals: [1000,2000,5000] }).toBe(200);
  await page.route("**/api/play", async route => {
    const input = route.request().postDataJSON(); const board = new Chess(input.startFen); for (const move of input.moves) board.move(move);
    await route.fulfill({ json: { fen: board.fen(), move: board.turn() === "w" ? "e2e4" : "e7e5" } });
  });
  await page.goto("/play"); await page.getByRole("button", { name: "Start game", exact: true }).click();
  const board = page.getByRole("group", { name: /Stockfish play position/ });
  await board.locator('[data-square="e2"]').click(); await board.locator('[data-square="e4"]').click();
  await expect(page.getByLabel("Game moves")).toContainText("e5"); await expect(page.getByLabel("Game status")).toContainText("Your turn");
  await page.screenshot({ path: `test-results/play-active-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "Show analysis assistance" }).click(); await expect(page.getByRole("button", { name: "Play move", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Close analysis" }).click(); await page.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.getByLabel("Game status")).toContainText("Resigned · 0-1");
  const downloadEvent = page.waitForEvent("download"); await page.getByRole("button", { name: "Download PGN" }).click(); expect((await downloadEvent).suggestedFilename()).toBe("stockfish-practice.pgn");
  await page.getByLabel("Your color").selectOption("BLACK"); await page.getByLabel("Difficulty", { exact: true }).selectOption("strong"); await page.getByRole("button", { name: "Restart with these settings" }).click();
  await expect(page.getByLabel("Game moves")).toContainText("e4"); await expect(page.getByRole("group", { name: /Stockfish play position/ })).toHaveAccessibleName(/Black at the bottom/);
  await page.getByLabel("Starting FEN").fill("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1"); await page.getByRole("button", { name: "Restart with these settings" }).click(); await expect(page.getByLabel("Game status")).toContainText("Checkmate · 1-0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: `test-results/play-${width}.png`, fullPage: true });
  const anonymous = await browser.newContext({ baseURL: origin });
  try { expect((await anonymous.request.post("/api/play", { headers: { origin }, data: {} })).status()).toBe(401); expect((await page.request.post("/api/play", { headers: { origin: "https://foreign.example" }, data: {} })).status()).toBe(403); } finally { await anonymous.close(); }
});
