import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Chess } from "chess.js";
import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
const fixture = readFileSync("tests/fixtures/pgn/complete.pgn", "utf8");
const ids: string[] = [];
// Sign-up is rate limited across the whole suite; wait for the window rather than fail.
const signUp = (request: import("@playwright/test").APIRequestContext, name: string) => expect.poll(async () => (await request.post("/api/auth/sign-up/email", {
  headers: { origin }, data: { name, email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "browser test passphrase" },
})).status(), { timeout: 65_000, intervals: [1000, 2000, 5000] }).toBe(200);

test.afterEach(() => {
  for (const id of ids.splice(0)) execFileSync(process.execPath, ["--import", "tsx", "tests/support/e2e-database.mts", "delete", id]);
});

// One journey and one account: sign-ups are limited to five a minute for the whole suite.
test("review notes and engine practice", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await signUp(page.request, "Notes tester");
  await page.goto("/games/new");
  await page.getByLabel("Your color").selectOption("WHITE");
  await page.getByLabel("Game PGN").fill(fixture.replace('[White "Aljaz"]', `[White "E2E-${process.env.CHESS_E2E_RUN_ID}-notes-${randomUUID()}"]`));
  await page.getByRole("button", { name: "Import and Analyze" }).click();
  await expect(page).toHaveURL(/\/games\/[a-z0-9-]{20,}(?:\?.*)?$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  ids.push(id);
  await expect(page.getByText("Saved analysis: 10 of 10 moves.", { exact: true })).toBeVisible();

  // Notes are optional: nothing but a quiet link until one is written.
  await page.getByRole("button", { name: "+ Add a note on this game" }).click();
  await page.getByLabel("Your note on this game").fill("Comfortable opening.\nReview the middlegame plan.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("region", { name: "Your note on this game" })).toContainText("Review the middlegame plan.");

  const moves = page.getByRole("table", { name: "Game moves" });
  await moves.getByRole("button", { name: /^3\. White Bb5/ }).click();
  await page.getByRole("button", { name: "+ Add a note on 3. Bb5" }).click();
  await page.getByLabel("Your note on 3. Bb5").fill("Ruy Lopez: pressure on e5 through the knight.");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("region", { name: "Your note on 3. Bb5" })).toContainText("pressure on e5");
  await expect(moves.getByRole("button", { name: /^3\. White Bb5.* — Has your note$/ })).toHaveAttribute("aria-current", "step");
  await page.screenshot({ path: "test-results/review-notes.png", fullPage: true });

  await page.reload();
  await expect(page.getByRole("region", { name: "Your note on this game" })).toContainText("Comfortable opening.");
  await moves.getByRole("button", { name: /^3\. White Bb5.* — Has your note$/ }).click();
  await expect(page.getByRole("region", { name: "Your note on 3. Bb5" })).toContainText("pressure on e5");
  await page.getByRole("button", { name: "Edit note on this game" }).click();
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByRole("button", { name: "+ Add a note on this game" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "+ Add a note on this game" })).toBeVisible();

  // Cross-owner writes are covered by the game-queries integration test.
  const note = { ply: 3, text: "Not mine" };
  expect((await page.request.put(`/api/games/${id}/notes`, { headers: { origin: "https://foreign.example" }, data: note })).status()).toBe(403);
  expect((await page.request.put(`/api/games/${id}/notes`, { headers: { origin }, data: { ply: 3, text: "x".repeat(4001) } })).status()).toBe(400);
  expect((await page.request.put(`/api/games/${id}/notes`, { headers: { origin }, data: { ply: 99, text: "No such move" } })).status()).toBe(404);
  const anonymous = await browser.newContext({ baseURL: origin });
  try { expect((await anonymous.request.put(`/api/games/${id}/notes`, { headers: { origin }, data: note })).status()).toBe(401); } finally { await anonymous.close(); }

  // Play the final position on: White (the player) is to move, the engine answers for Black.
  const requests: { startFen: string; moves: string[]; color: string; difficulty: string }[] = [];
  await page.route("**/api/play", async route => {
    const input = route.request().postDataJSON(); requests.push(input);
    const board = new Chess(input.startFen); for (const move of input.moves) board.move(move);
    await route.fulfill({ json: { fen: board.fen(), move: "d7d6" } });
  });
  await moves.getByRole("button", { name: /^5\. Black Be7/ }).click();
  await page.getByRole("button", { name: "Play on against the engine" }).click();
  const status = page.getByRole("status", { name: "Practice status" });
  await expect(status).toHaveText("Your turn");
  const board = page.getByRole("group", { name: /Practice position, White at the bottom/ });
  await board.locator('[data-square="d2"]').click(); await board.locator('[data-square="d3"]').click();
  await expect(page.getByLabel("Practice moves")).toHaveText("6. d3 6… d6");
  await expect(status).toHaveText("Your turn");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ moves: ["d2d3"], color: "WHITE", difficulty: "strong" });
  expect(new Chess(requests[0].startFen).board().flat().filter(Boolean)).toHaveLength(32);
  await page.keyboard.press("ArrowLeft");
  await expect(board).toBeVisible();
  await page.screenshot({ path: "test-results/review-practice.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(board).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/review-practice-390.png", fullPage: true });
  await page.getByRole("button", { name: "Take back" }).click();
  await expect(page.getByLabel("Practice moves")).toHaveText("No moves yet");
  await page.getByRole("button", { name: "Return to review" }).click();
  await expect(page.getByText(/^Move 5\.\.\. Be7 · Half-move 10 of 10/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Your note on 3. Bb5" })).toHaveCount(0);
});
