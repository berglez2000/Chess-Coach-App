import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3100";
for (const width of [1200, 390]) test(`position analysis, opening authoring and review at ${width}px`, async ({ page, browser }) => {
  test.setTimeout(120000); await page.setViewportSize({ width, height: 900 });
  const email = `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`;
  // Other browser journeys share the local origin and its five-signups/minute limit.
  await expect.poll(async () => (await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Analysis tester", email, password: "analysis browser passphrase" } })).status(), { timeout: 65000, intervals: [1000, 2000, 5000] }).toBe(200);
  let requests = 0; page.on("request", request => { if (new URL(request.url()).pathname === "/api/analysis") requests++; });
  await page.goto("/analysis"); await expect(page.getByRole("heading", { name: "Analysis", exact: true })).toBeVisible();
  expect(requests).toBe(0);
  const board = page.getByRole("group", { name: /Analysis position/ });
  await board.locator('[data-square="e2"]').click(); await board.locator('[data-square="e4"]').click();
  await page.getByLabel("Move coordinates").fill("e7e5"); await page.getByRole("button", { name: "Play move", exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByLabel("Analysis thinking time").selectOption("quick"); await page.getByRole("button", { name: "Analyze position" }).click();
  const panel = page.getByRole("region", { name: "Deeper position analysis" });
  await expect(page.getByRole("status", { name: "Analysis status" })).toContainText("Search complete");
  await expect(panel.getByText("-0.32", { exact: true })).toBeVisible(); await expect(panel.getByRole("button", { name: /^Try / })).toHaveCount(3);
  await page.getByRole("button", { name: "Flip board" }).click(); await expect(board).toHaveAccessibleName(/Black at the bottom/);
  await panel.getByRole("button", { name: /^Try / }).first().click(); await expect(page.getByRole("status", { name: "Board status" })).toContainText("White to move");
  await expect(page.getByRole("status", { name: "Analysis status" })).toContainText("Search complete");
  await page.screenshot({ path: `test-results/position-analysis-${width}.png`, fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Disable analysis" }).click(); await page.getByText("Starting position", { exact: true }).click();
  await page.getByLabel("Starting FEN").fill("r7/8/8/8/8/2k5/8/K7 w - - 0 1"); await page.getByRole("button", { name: "Load position" }).click();
  await page.getByRole("button", { name: "Analyze position" }).click(); await expect(page.getByRole("status", { name: "Analysis status" })).toContainText("Search complete"); await expect(panel.getByRole("button", { name: /^Try / })).toHaveCount(1);
  await page.getByLabel("Starting FEN").fill("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1"); await page.getByRole("button", { name: "Load position" }).click(); await expect(panel.getByText("White delivered checkmate.")).toBeVisible();
  const created = await page.request.post("/api/openings", { headers: { origin }, data: { name: "Analysis repertoire", description: "Private preparation", color: "WHITE", startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", lines: [{ name: "King pawn", moves: ["e2e4", "e7e5"] }] } }); expect(created.status()).toBe(201); const opening = (await created.json()).opening;
  await page.goto(`/openings/${opening.id}/edit`); const beforeEditor = requests;
  await page.getByRole("button", { name: "Analyze position" }).click(); await expect(page.getByRole("status", { name: "Analysis status" })).toContainText("Search complete");
  expect(requests).toBeGreaterThan(beforeEditor);
  await page.getByRole("region", { name: "Deeper position analysis" }).getByRole("button", { name: /^Try / }).first().click(); await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save opening" }).click(); await expect(page.getByText("Opening saved.")).toBeVisible();
  await page.goto(`/openings/${opening.id}/practice`); const beforePractice = requests; await expect(page.getByRole("button", { name: "Analyze position" })).toHaveCount(0); expect(requests).toBe(beforePractice);
  const imported = await page.request.post("/api/games", { headers: { origin }, data: { userColor: "BLACK", pgn: '[White "Analysis White"]\n[Black "Analysis Black"]\n\n1. e4 e5 2. Nf3 *' } }); expect(imported.status()).toBe(201); const gameId = (await imported.json()).gameId; expect(gameId).toEqual(expect.any(String));
  await page.goto(`/games/${gameId}`); await expect(page.getByRole("tab", { name: "Engine", exact: true })).toBeVisible(); await page.getByRole("tab", { name: "Engine", exact: true }).click();
  await page.getByRole("button", { name: "Analyze position" }).click(); await expect(page.getByRole("status", { name: "Analysis status" })).toContainText("Search complete");
  await page.getByRole("button", { name: "Explore position" }).click(); await page.getByLabel("Move coordinates").fill("d2d4"); await page.getByRole("button", { name: "Play move", exact: true }).click();
  await page.getByRole("button", { name: "Analyze position" }).click(); await expect(page.getByRole("status", { name: "Analysis status" })).toContainText("Search complete");
  await page.getByRole("button", { name: "Return to review" }).click(); await expect(page.getByText("Initial position · Half-move 0 of 3")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const anonymous = await browser.newContext({ baseURL: origin });
  try {
    expect((await anonymous.request.post("/api/analysis", { headers: { origin }, data: { startFen: "bad", preset: "quick" } })).status()).toBe(401);
    expect((await page.request.post("/api/analysis", { headers: { origin: "https://foreign.example" }, data: { startFen: "bad", preset: "quick" } })).status()).toBe(403);
  } finally { await anonymous.close(); }
});
