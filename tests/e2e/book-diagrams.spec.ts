import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

// Supply the local reference book without distributing its copyrighted contents.
test("JBIG2 diagrams render on the reference book's puzzle page", async ({ page }) => {
  const source = process.env.CHESS_BOOKS_DIAGRAM_PDF;
  test.skip(!source, "Set CHESS_BOOKS_DIAGRAM_PDF to the local beginners reference PDF.");
  if (!source) return;
  test.setTimeout(120_000);
  const origin = "http://127.0.0.1:3100";
  const warnings: string[] = [];
  page.on("console", message => { if (/Unable to decode image|JBig2 failed|wasmUrl.*provided/.test(message.text())) warnings.push(message.text()); });
  const decoderLoads: number[] = [];
  page.on("response", response => { if (response.url().endsWith("/jbig2.wasm")) decoderLoads.push(response.status()); });
  const signup = await page.request.post(`${origin}/api/auth/sign-up/email`, { headers: { origin }, data: {
    name: "Diagram tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "diagram browser test passphrase",
  } });
  expect(signup.status()).toBe(200);
  const uploaded = await page.request.post(`${origin}/api/books?name=Diagram%20reference`, { headers: { origin, "Content-Type": "application/pdf" }, data: await readFile(source) });
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  await page.goto("/learning");
  await page.getByRole("button", { name: /^(Open|Continue) Diagram reference$/ }).click();
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeEnabled();
  await page.getByLabel("Page number", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Page 7 of 126 · Saved" })).toBeVisible();
  // The first chessboard lies here, clear of titles and captions. A blank image
  // previously passed page-render success checks; now require actual dark pixels.
  const darkPixels = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d")!;
    const pixels = context.getImageData(Math.floor(canvas.width * 0.08), Math.floor(canvas.height * 0.09), Math.floor(canvas.width * 0.24), Math.floor(canvas.height * 0.14)).data;
    let dark = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 120 && pixels[i + 1] < 120 && pixels[i + 2] < 120) dark++;
    return dark;
  });
  expect(darkPixels).toBeGreaterThan(1000);
  expect(decoderLoads).toContain(200);
  expect(warnings).toEqual([]);
  await page.locator("canvas").screenshot({ path: "/private/tmp/chess-coach-diagrams.png" });
});
