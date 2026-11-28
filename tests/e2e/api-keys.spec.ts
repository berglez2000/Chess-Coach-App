import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
const key = "sk-e2e-personal-fixture-key-00007531";
test("a user adds, keeps, and removes a personal API key that no one else sees", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const signUp = (request: typeof page.request) => request.post("/api/auth/sign-up/email", { headers: { origin },
    data: { name: "Key tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "browser test passphrase" } });
  expect((await signUp(page.request)).status()).toBe(200);
  await page.goto("/settings");
  const openai = page.getByRole("listitem").filter({ hasText: "OpenAI (GPT)" });
  await expect(openai).toContainText("Unavailable — add your key");
  await expect(openai.getByRole("button", { name: "Save key" })).toBeDisabled();
  await page.getByLabel("OpenAI (GPT) API key").fill("too short");
  await openai.getByRole("button", { name: "Save key" }).click();
  await expect(openai).toContainText("Unavailable");
  await page.getByLabel("OpenAI (GPT) API key").fill(key);
  await openai.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByRole("status")).toHaveText("OpenAI (GPT) key saved.");
  await expect(openai).toContainText("Using your key ending in 7531.");
  await expect(page.getByLabel("OpenAI (GPT) API key")).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(openai).toContainText("Using your key ending in 7531.");
  expect(await page.content()).not.toContain(key.slice(0, -4));
  const settings = await page.request.get("/api/settings");
  expect(await settings.text()).not.toContain(key.slice(0, -4));
  expect(await settings.json()).toMatchObject({ available: { OPENAI: true }, personalKeys: { OPENAI: { lastFour: "7531", readable: true } } });
  expect((await page.request.put("/api/settings/keys/OPENAI", { headers: { origin: "https://other.example" }, data: { apiKey: key } })).status()).toBe(403);

  const context = await browser.newContext({ baseURL: origin });
  try {
    expect((await context.request.delete("/api/settings/keys/OPENAI", { headers: { origin } })).status()).toBe(401);
    expect((await signUp(context.request)).status()).toBe(200);
    expect(await (await context.request.get("/api/settings")).json()).toMatchObject({ available: { OPENAI: false }, personalKeys: {} });
    expect((await context.request.delete("/api/settings/keys/OPENAI", { headers: { origin } })).status()).toBe(200);
  } finally { await context.close(); }

  await page.reload();
  await expect(openai).toContainText("Using your key ending in 7531.");
  await openai.getByRole("button", { name: "Remove key" }).click();
  await expect(page.getByRole("status")).toHaveText("OpenAI (GPT) key removed.");
  await expect(openai).toContainText("Unavailable — add your key");
});
