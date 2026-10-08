import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { ledBytes } from "@/lib/chesslink/protocol";
import { differingSquares } from "@/lib/play/physical-board";
import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3100";
for (const width of [1200,390]) test(`Millennium Stockfish play at ${width}px`, async ({ page }) => {
  test.setTimeout(120000); await page.setViewportSize({ width, height: 900 });
  await page.addInitScript((reverseReports: boolean) => {
    type FixtureWindow = Window & { chesslinkFixture: { placement: string; emit: () => void; disconnect: () => void } };
    const fixture = { commands: [] as string[], placement: "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR", emit: () => {}, disconnect: () => {} };
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
        let buffer = "";
        const write = { writeValueWithResponse: async (bytes: Uint8Array) => {
          if (bytes.length > 20) throw new Error("BLE packet exceeds fixture limit");
          buffer += [...bytes].map(byte => String.fromCharCode(byte & 127)).join("");
          while (buffer.length >= (buffer[0] === "L" ? 167 : 3)) {
            const length = buffer[0] === "L" ? 167 : 3; const command = buffer.slice(0,length); buffer = buffer.slice(length);
            fixture.commands.push(command); if (command[0] === "S") emit();
          }
        } };
        const device = Object.assign(new EventTarget(), { gatt: {
          connected: true, connect: async () => device.gatt, disconnect: () => {},
          getPrimaryService: async () => ({ getCharacteristic: async (uuid: string) => uuid.includes("1e4d") ? notify : write }),
        } });
        fixture.disconnect = () => device.dispatchEvent(new Event("gattserverdisconnected"));
        return device;
      },
    } });
  }, width === 390);
  await expect.poll(async () => (await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Physical player", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "physical stockfish passphrase" } })).status(), { timeout: 65000, intervals: [1000,2000,5000] }).toBe(200);
  await page.goto("/play"); await page.getByLabel("Move input").selectOption("millennium");
  await page.getByRole("button", { name: "Connect Millennium board", exact: true }).click();
  await expect(page.getByLabel("Physical board status")).toContainText("Synchronized");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  const chess = new Chess();
  async function report(board: Chess) {
    const placement = board.fen().split(" ")[0].replaceAll("/", "").replace(/\d/g, digit => ".".repeat(Number(digit)));
    await page.evaluate(placement => { const fixture = (window as unknown as { chesslinkFixture: { placement: string; emit: () => void } }).chesslinkFixture; fixture.placement = placement; fixture.emit(); },placement);
  }
  const lifted = new Chess(); lifted.remove("e2"); await report(lifted);
  await expect(page.getByText("Move in progress. Complete all piece movements.")).toBeVisible();
  chess.move("e4"); await report(chess);
  // Deterministic test engine chooses its first legal move; read the actual reply from the screen.
  await expect(page.getByLabel("Game moves")).toContainText("1…");
  const last = await page.getByText(/^Last move:/).innerText(); const uci = /\(([a-h][1-8][a-h][1-8][qrbn]?)\)/.exec(last)![1];
  await expect(page.getByLabel("Game status")).toContainText("Synchronize");
  const beforeReply = chess.fen().split(" ")[0]; chess.move(uci);
  const expectedLed = [...ledBytes(differingSquares(beforeReply,chess.fen()),width === 390)].map(byte => String.fromCharCode(byte & 127)).join("");
  const commands = () => page.evaluate(() => (window as unknown as { chesslinkFixture: { commands: string[] } }).chesslinkFixture.commands);
  await expect.poll(commands).toContain(expectedLed);
  await report(chess); await expect(page.getByLabel("Physical board status")).toContainText("Synchronized");
  await expect(page.getByLabel("Game status")).toContainText("Your turn");
  await expect.poll(async () => (await commands()).at(-1)).toBe("X58");
  await page.screenshot({ path: `test-results/millennium-play-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => (window as unknown as { chesslinkFixture: { disconnect: () => void } }).chesslinkFixture.disconnect());
  await expect(page.getByLabel("Game status")).toContainText("Play paused");
  await page.getByRole("button", { name: "Connect Millennium board", exact: true }).click();
  // A new fixture connection reports its current full position and query verifies it again.
  await page.getByRole("button", { name: "Query position", exact: true }).click();
  await expect(page.getByLabel("Physical board status")).toContainText("Synchronized");
  await page.getByRole("button", { name: "Resume / retry engine" }).click();
  await expect(page.getByLabel("Game status")).toContainText("Your turn");
  await page.getByLabel("Move input").selectOption("screen"); await expect(page.getByLabel("Physical board status")).toHaveCount(0);
});
