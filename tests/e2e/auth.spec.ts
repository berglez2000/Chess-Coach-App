import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
test("email/password registration, private data, password change and logout", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`;
  const password = "my browser test passphrase";
  await page.goto("/games");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await page.request.get("/api/games")).status()).toBe(401);
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Chess tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill("a different passphrase");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Passwords do not match.");
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(origin + "/");
  await page.getByLabel("Account menu", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByLabel("Account menu", { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const imported = await page.request.post("/api/games", { headers: { origin }, data: { userColor: "WHITE", pgn: "1. e4 e5 *", ownerId: "forged-owner" } });
  // Unknown fields cannot assign ownership; the server derives it from the session.
  expect(imported.status()).toBe(201);
  const { gameId } = await imported.json();
  await page.goto("/settings");
  await page.getByLabel("Coaching provider").selectOption("OPENAI");
  await page.getByRole("button", { name: "Save provider" }).click();
  await expect(page.getByRole("status")).toHaveText("Coaching provider saved.");

  const other = await browser.newContext();
  try {
    const response = await other.request.post(`${origin}/api/auth/sign-up/email`, { headers: { origin }, data: { name: "Other tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password } });
    expect(response.status()).toBe(200);
    expect((await other.request.get(`${origin}/api/games/${gameId}`)).status()).toBe(404);
    expect((await other.request.post(`${origin}/api/games/${gameId}/analyze`, { headers: { origin } })).status()).toBe(404);
    expect((await other.request.post(`${origin}/api/games/${gameId}/coaching`, { headers: { origin }, data: { expectedRevision: 0 } })).status()).toBe(404);
    expect(await (await other.request.get(`${origin}/api/games`)).json()).toEqual({ games: [] });
    expect(await (await other.request.get(`${origin}/api/settings`)).json()).toMatchObject({ provider: "ANTHROPIC" });
    const otherPage = await other.newPage();
    await otherPage.goto(`${origin}/games/${gameId}`);
    await expect(otherPage.getByRole("heading", { name: /not found/i })).toBeVisible();
  } finally { await other.close(); }

  await page.goto("/profile");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("New password", { exact: true }).fill(password + " updated");
  await page.getByLabel("Confirm new password", { exact: true }).fill(password + " updated");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Password changed. Other devices have been signed out.");
  await page.getByLabel("Account menu", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await page.request.get(`/api/games/${gameId}`)).status()).toBe(401);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Could not sign in");
  await page.getByLabel("Password", { exact: true }).fill(password + " updated");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(origin + "/");
  await page.reload();
  expect((await page.request.get(`/api/games/${gameId}`)).status()).toBe(200);
});
