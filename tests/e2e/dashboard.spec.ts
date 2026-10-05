import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("dashboard shows account data and fits desktop and mobile", async ({ page }) => {
  const origin = "http://127.0.0.1:3100";
  const response = await page.request.post(`${origin}/api/auth/sign-up/email`, { headers: { origin }, data: {
    name: "Dashboard Tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "dashboard browser test passphrase",
  } });
  expect(response.status()).toBe(200);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dashboard.");
  await expect(page.getByText("No games yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "App navigation", exact: true }).getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");
  const imported = await page.request.post("/api/games", { headers: { origin }, data: { userColor: "WHITE", pgn: '[White "Dashboard White"]\n[Black "Dashboard Black"]\n\n1. e4 e5 *' } });
  expect(imported.status()).toBe(201);
  const { gameId } = await imported.json();
  await page.reload();
  await expect(page.getByRole("link", { name: /Dashboard White vs. Dashboard Black/ })).toHaveAttribute("href", `/games/${gameId}`);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/chess-dashboard-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Mobile navigation", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/chess-dashboard-mobile.png", fullPage: true });
  await page.getByLabel("Account menu", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true }).filter({ visible: true })).toBeVisible();
});
