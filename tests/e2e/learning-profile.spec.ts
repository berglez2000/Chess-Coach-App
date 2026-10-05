import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
const origin = "http://127.0.0.1:3100";
let otherState: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;
for (const width of [1200, 390]) test(`learning profile: review, save, edit and isolate at ${width}px`, async ({ page, browser }) => {
  await page.setViewportSize({ width, height: 900 });
  const signup = await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Profile tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "learning profile passphrase" } });
  expect(signup.status()).toBe(200);
  await page.goto("/learning"); await page.getByRole("link", { name: "Learning profile", exact: true }).click();
  await page.getByRole("button", { name: "Review answers" }).click(); await expect(page.getByRole("alert", { name: "Learning profile feedback" })).toBeVisible();
  await page.getByLabel("Reduce blunders").check(); await page.getByLabel("Not sure", { exact: true }).check();
  await page.getByLabel("Puzzles", { exact: true }).check(); await page.getByLabel("Tuesday", { exact: true }).check(); await page.getByLabel("Saturday", { exact: true }).check();
  await page.getByLabel("Saturday study minutes").fill("45"); await page.getByLabel("10. Current focus (optional)").fill("Improve calculation");
  await page.getByRole("button", { name: "Review answers" }).click();
  await expect(page.getByText("65 minutes across 2 study days")).toBeVisible();
  expect((await (await page.request.get("/api/learning/profile")).json()).profile).toBeNull();
  await page.getByRole("button", { name: "Save learning profile" }).click(); await expect(page.getByRole("heading", { name: "Your saved learning profile" })).toBeVisible();
  await page.reload(); await expect(page.getByText("Improve calculation", { exact: true })).toBeVisible();
  const first = (await (await page.request.get("/api/learning/profile")).json()).profile;
  const staleTab = await page.context().newPage(); await staleTab.goto("/learning/profile");
  await page.getByRole("button", { name: "Edit profile" }).click(); await page.getByLabel("Tuesday study minutes").fill("30");
  await page.getByRole("button", { name: "Review answers" }).click(); await page.getByRole("button", { name: "Save learning profile" }).click();
  await expect(page.getByText("75 minutes across 2 study days")).toBeVisible();
  await staleTab.getByRole("button", { name: "Edit profile" }).click(); await staleTab.getByLabel("10. Current focus (optional)").fill("Different tab");
  await staleTab.getByRole("button", { name: "Review answers" }).click(); await staleTab.getByRole("button", { name: "Save learning profile" }).click();
  await expect(staleTab.getByRole("alert", { name: "Learning profile feedback" })).toContainText("another tab"); await staleTab.close();
  const invalid = await page.request.put("/api/learning/profile", { headers: { origin }, data: { expectedRevision: 2, answers: { ...first.answers, availability: [{ day: "Tuesday", minutes: 0 }] } } }); expect(invalid.status()).toBe(400);
  expect((await page.request.put("/api/learning/profile", { headers: { origin: "https://other.example" }, data: {} })).status()).toBe(403);
  const other = await browser.newContext({ baseURL: origin });
  try {
    expect((await other.request.get("/api/learning/profile")).status()).toBe(401);
    expect((await other.request.put("/api/learning/profile", { headers: { origin }, data: { expectedRevision: 0, answers: first.answers } })).status()).toBe(401);
    if (otherState) await other.addCookies(otherState.cookies);
    else { expect((await other.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Other profile tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "other profile passphrase" } })).status()).toBe(200);
      otherState = await other.storageState();
      expect((await (await other.request.get("/api/learning/profile")).json()).profile).toBeNull();
    }
    const otherProfile = (await (await other.request.get("/api/learning/profile")).json()).profile;
    const otherRevision = otherProfile?.revision ?? 0;
    expect((await other.request.put("/api/learning/profile", { headers: { origin }, data: { expectedRevision: 0, answers: { ...first.answers, userId: first.userId ?? "someone-else" } } })).status()).toBe(400);
    expect((await other.request.put("/api/learning/profile", { headers: { origin }, data: { expectedRevision: otherRevision, answers: { ...first.answers, focus: "Other user focus" } } })).status()).toBe(200);
  } finally { await other.close(); }
  await page.reload(); await expect(page.getByText("Improve calculation", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/learning-profile-${width}.png`, fullPage: true });
});
