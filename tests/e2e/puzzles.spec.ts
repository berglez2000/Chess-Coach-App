import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
for (const color of ["WHITE", "BLACK"] as const) {
  test(`${color}: solve, reload, retry, assistance, source navigation and private progress`, async ({ page, browser }) => {
    if (color === "BLACK") await page.setViewportSize({ width: 390, height: 844 });
    const email = `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`;
    const signup = await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Puzzle tester", email, password: "browser puzzle passphrase" } });
    expect(signup.status()).toBe(200);
    const fixture = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "tests/support/e2e-puzzles.mts", email, color], { encoding: "utf8" })) as { gameId: string; ids: string[] };
    const white = color === "WHITE";
    await page.goto(`/games/${fixture.gameId}`);
    await page.getByRole("link", { name: "Practice these puzzles" }).click();
    await page.getByRole("link", { name: new RegExp(`half-move ${white ? 1 : 2}$`) }).click();
    await expect(page.getByRole("group", { name: `Puzzle position, ${white ? "White" : "Black"} at the bottom` })).toBeVisible();
    const before = await (await page.request.get(`/api/puzzles/${fixture.ids[0]}`)).json();
    expect(before.puzzle.solution).toBeNull();
    expect(before.puzzle.acceptedMoves).toBeUndefined();
    await expect(page.getByText(/^Solution:/)).toHaveCount(0);
    await page.getByLabel("Move coordinates").fill(white ? "e2e5" : "e7e4");
    await page.getByRole("button", { name: "Check move" }).click();
    await expect(page.getByRole("status", { name: "Puzzle feedback" })).toContainText("Illegal move");
    await page.getByLabel("Move coordinates").fill(white ? "g1f3" : "b8c6");
    await page.getByRole("button", { name: "Check move" }).click();
    await expect(page.getByRole("status", { name: "Puzzle feedback" })).toContainText("legal, but it is not a solution");
    // Exercise actual rendered board square interactions.
    const board = page.getByRole("group", { name: /Puzzle position/ });
    await board.locator(`[data-square="${white ? "e2" : "e7"}"]`).click();
    await board.locator(`[data-square="${white ? "e4" : "e5"}"]`).click();
    await expect(page.getByRole("status", { name: "Puzzle feedback" })).toContainText("Correct! Puzzle solved");
    await expect(page.getByText("First completion saved · Unassisted")).toBeVisible();
    await page.reload();
    await expect(page.getByText("First completion saved · Unassisted")).toBeVisible();
    await expect(page.getByText("Moves tried: 3")).toBeVisible();
    await page.getByRole("button", { name: "Retry puzzle" }).click();
    await expect(page.getByRole("status", { name: "Puzzle feedback" })).toContainText("Starting position restored");
    await page.getByLabel("Move coordinates").fill(white ? "d2d4" : "c7c5");
    await page.getByRole("button", { name: "Check move" }).click();
    await expect(page.getByRole("status", { name: "Puzzle feedback" })).toContainText("accepted alternative");
    await expect(page.getByText("First completion saved · Unassisted")).toBeVisible();
    await page.getByRole("link", { name: "Next puzzle" }).click();
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await expect(page.getByText(/^Hint: move/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/^Hint: move/)).toBeVisible();
    await page.getByRole("button", { name: "Reveal solution" }).click();
    await expect(page.getByText(/^Solution:/)).toBeVisible();
    await expect(page.getByText(/First completion saved/)).toHaveCount(0);
    await page.getByRole("button", { name: "Retry puzzle" }).click();
    await expect(page.getByRole("status", { name: "Puzzle feedback" })).toContainText("Starting position restored");
    await page.getByLabel("Move coordinates").fill(white ? "f3e5" : "g8f6");
    await page.getByRole("button", { name: "Check move" }).click();
    await expect(page.getByText("First completion saved · Assisted")).toBeVisible();
    await page.getByRole("link", { name: "Return to source review" }).click();
    await expect(page).toHaveURL(new RegExp(`/games/${fixture.gameId}\\?ply=${white ? 3 : 4}$`));
    await expect(page.getByText(white ? /Move 2\. d4/ : /Move 2\.\.\. h6/)).toBeVisible();
    const other = await browser.newContext({ baseURL: origin });
    try {
      expect((await other.request.get(`/api/puzzles/${fixture.ids[0]}`)).status()).toBe(401);
      const response = await other.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Other tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "another puzzle passphrase" } });
      expect(response.status()).toBe(200);
      expect((await other.request.get(`/api/puzzles/${fixture.ids[0]}`)).status()).toBe(404);
      expect((await other.request.post(`/api/puzzles/${fixture.ids[0]}`, { headers: { origin }, data: { action: "REVEAL", expectedRevision: 0, requestId: randomUUID() } })).status()).toBe(404);
    } finally { await other.close(); }
  });
}
