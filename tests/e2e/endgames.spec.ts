import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3100";
for (const width of [1200, 390]) test(`Endgame saved practice at ${width}px`, async ({ page, browser }) => {
  test.setTimeout(120000); await page.setViewportSize({ width, height: 900 });
  const email = `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`;
  await expect.poll(async () => (await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Endgame tester", email, password: "endgame browser passphrase" } })).status(), { timeout: 65000 }).toBe(200);
  let engineReplies = 0;
  await page.route("**/api/play", async route => {
    engineReplies++; const input = route.request().postDataJSON(); const board = new Chess(input.startFen); for (const move of input.moves) board.move(move);
    await route.fulfill({ json: { fen: board.fen(), move: board.moves({ verbose: true })[0].lan } });
  });
  await page.goto("/endgames/basic-checkmates/queen-white");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(page.getByLabel("Saved practice progress")).toContainText("1 attempts · Saved");
  await page.getByLabel("Move coordinates").fill("d2d3"); await page.getByRole("button", { name: "Play move", exact: true }).click();
  await expect(page.getByLabel("Game status")).toContainText("Your turn"); await expect(page.getByLabel("Saved practice progress")).toContainText("Saved");
  const moves = await page.getByLabel("Game moves").innerText(); expect(engineReplies).toBe(1);
  await page.getByRole("button", { name: "Show endgame hint" }).click(); await expect(page.getByLabel("Saved practice progress")).toContainText("Saved");
  await page.reload();
  await expect(page.getByLabel("Game status")).toContainText("Play paused"); await expect(page.getByLabel("Game moves")).toHaveText(moves); expect(engineReplies).toBe(1);
  await expect(page.getByRole("button", { name: "Show endgame hint" })).toBeDisabled();
  await page.getByRole("button", { name: "Resign", exact: true }).click(); await expect(page.getByLabel("Saved practice progress")).toContainText("Saved");
  await page.reload(); await expect(page.getByLabel("Game status")).toContainText("Resigned");
  let failSave = true;
  await page.route("**/api/endgames/queen-white/progress", async route => { if (failSave) { failSave = false; await route.fulfill({ status: 503, json: { error: { message: "Test save failure" } } }); } else await route.continue(); });
  await page.getByRole("button", { name: "Restart with these settings" }).click(); await expect(page.getByText("Test save failure")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play move", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry save" }).click(); await expect(page.getByLabel("Saved practice progress")).toContainText("2 attempts · Saved");
  await page.goto("/endgames/basic-checkmates"); await expect(page.getByText("In progress · Resume saved game")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/endgames-progress-${width}.png`, fullPage: true });
  const other = await browser.newContext({ baseURL: origin });
  try {
    expect((await other.request.post("/api/endgames/queen-white/progress", { headers: { origin }, data: {} })).status()).toBe(401);
    expect((await page.request.post("/api/endgames/queen-white/progress", { headers: { origin: "https://foreign.example" }, data: {} })).status()).toBe(403);
    await other.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Other tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "another browser passphrase" } });
    const foreign = await other.newPage(); await foreign.goto("/endgames/basic-checkmates/queen-white");
    await expect(foreign.getByLabel("Game moves")).toHaveText("No moves yet"); await expect(foreign.getByLabel("Saved practice progress")).toContainText("0 attempts");
  } finally { await other.close(); }
});
