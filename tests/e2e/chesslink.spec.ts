import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
for (const width of [1200, 390]) test(`ChessLink simulated recording, recovery and owned save at ${width}px`, async ({ page, browser }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript((reverseReports: boolean) => {
    type FixtureWindow = Window & { chesslinkFixture: { placement: string; emit: () => void; disconnect: () => void } };
    const fixture = { placement: "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR", emit: () => {}, disconnect: () => {} };
    (window as unknown as FixtureWindow).chesslinkFixture = fixture;
    Object.defineProperty(navigator, "bluetooth", { configurable: true, value: {
      requestDevice: async () => {
        const notify = Object.assign(new EventTarget(), { value: new DataView(new ArrayBuffer(0)), startNotifications: async () => { setTimeout(() => fixture.emit(), 0); return notify; } });
        const emit = () => {
          const text = `s${reverseReports ? [...fixture.placement].reverse().join("") : fixture.placement}`;
          const checksum = [...text].reduce((sum, char) => sum ^ char.charCodeAt(0), 0).toString(16).toUpperCase().padStart(2, "0");
          notify.value = new DataView(Uint8Array.from(text + checksum, char => char.charCodeAt(0) | 128).buffer);
          notify.dispatchEvent(new Event("characteristicvaluechanged"));
        };
        fixture.emit = emit;
        const write = { writeValueWithResponse: async (bytes: Uint8Array) => { if ((bytes[0] & 127) === 83) emit(); } };
        const device = Object.assign(new EventTarget(), { gatt: {
          connected: true, connect: async () => device.gatt, disconnect: () => {},
          getPrimaryService: async () => ({ getCharacteristic: async (uuid: string) => uuid.includes("1e4d") ? notify : write }),
        } });
        fixture.disconnect = () => device.dispatchEvent(new Event("gattserverdisconnected"));
        return device;
      },
    } });
  }, width === 390);
  const signup = await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: {
    name: "Board tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "board recording browser passphrase",
  } });
  expect(signup.status()).toBe(200);
  await page.goto("/games"); await page.getByRole("link", { name: "Record board game" }).click();
  await expect(page.getByRole("button", { name: "Start recording" })).toBeDisabled();
  await page.getByRole("button", { name: "Connect board", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start recording" })).toBeEnabled();
  await page.getByRole("button", { name: "Start recording" }).click();
  const chess = new Chess();
  async function report(move: string) {
    const lifted = new Chess(chess.fen());
    const played = chess.move(move); const uci = played.from + played.to + (played.promotion ?? "");
    lifted.remove(played.from);
    const intermediate = lifted.fen().split(" ")[0].replaceAll("/", "").replace(/\d/g, digit => ".".repeat(Number(digit)));
    await page.evaluate(placement => {
      const fixture = (window as unknown as { chesslinkFixture: { placement: string; emit: () => void } }).chesslinkFixture;
      fixture.placement = placement; fixture.emit();
    }, intermediate);
    await expect(page.getByText("Move in progress. Complete the move on the physical board; recording is still active.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    const placement = chess.fen().split(" ")[0].replaceAll("/", "").replace(/\d/g, digit => ".".repeat(Number(digit)));
    await page.evaluate(placement => {
      const fixture = (window as unknown as { chesslinkFixture: { placement: string; emit: () => void } }).chesslinkFixture;
      fixture.placement = placement; fixture.emit();
    }, placement);
    await expect(page.getByText(`Recorded ${played.san}.`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Confirm ${uci}`, exact: true })).toHaveCount(0);
  }
  await report("f3");
  await page.evaluate(() => (window as unknown as { chesslinkFixture: { disconnect: () => void } }).chesslinkFixture.disconnect());
  await expect(page.getByRole("button", { name: "Resume recording" })).toBeDisabled();
  await page.reload();
  await expect(page.getByText(/1 half-moves recorded/)).toBeVisible();
  await page.getByRole("button", { name: "Connect board", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reconnect" })).toBeVisible();
  chess.move("e5");
  const recoveredPosition = chess.fen().split(" ")[0].replaceAll("/", "").replace(/\d/g, digit => ".".repeat(Number(digit)));
  await page.evaluate(placement => {
    const fixture = (window as unknown as { chesslinkFixture: { placement: string; emit: () => void } }).chesslinkFixture;
    fixture.placement = placement;
    fixture.emit();
  }, recoveredPosition);
  await page.getByLabel("Moves already played").fill("1. f3 e5");
  await page.getByRole("button", { name: "Recover played moves" }).click();
  await expect(page.getByText(/2 half-moves recorded/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume recording" })).toBeEnabled();
  await page.getByRole("button", { name: "Resume recording" }).click();
  await report("g4"); await report("Qh4#");
  await page.getByRole("button", { name: "Finish game" }).click();
  await expect(page.getByLabel("Result", { exact: true })).toHaveValue("0-1");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PGN", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("king-performance.pgn");
  await page.screenshot({ path: `test-results/chesslink-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const saveRequest = page.waitForRequest(request => request.url().endsWith("/api/games") && request.method() === "POST");
  await page.getByRole("button", { name: "Save to My Games" }).click();
  const payload = (await saveRequest).postDataJSON();
  const review = page.getByRole("link", { name: /Review and analyze game/ }); await expect(review).toBeVisible();
  const href = await review.getAttribute("href"); const id = href!.split("/").at(-1)!.split("?")[0];
  const body = await (await page.request.get(`/api/games/${id}`)).json();
  expect(body.game.game.moves).toHaveLength(4);
  const repeated = await page.request.post("/api/games", { headers: { origin }, data: payload });
  expect(repeated.status()).toBe(201); expect((await repeated.json()).gameId).toBe(id);
  const recorded = await page.evaluate(() => Object.values(localStorage).find(value => value.includes('"savePgn"')) ?? null);
  expect(recorded).toBeNull();
  const other = await browser.newContext({ baseURL: origin });
  try {
    expect((await other.request.get(`/api/games/${id}`)).status()).toBe(401);
    expect((await other.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Other", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "other board passphrase" } })).status()).toBe(200);
    expect((await other.request.get(`/api/games/${id}`)).status()).toBe(404);
  } finally { await other.close(); }
  await review.click(); await expect(page).toHaveURL(new RegExp(`/games/${id}`));
});
