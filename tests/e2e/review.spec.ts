import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { execFileSync } from "node:child_process";
import type { Prisma } from "../../generated/prisma/client";

type StoredGame = Prisma.GameGetPayload<{ include: { moves: { include: { engineAnalysis: true; coachingAnnotation: true } } } }>;
function database(action: "read", id: string): StoredGame;
function database(action: "delete", id: string): void;
function database(action: "read" | "delete", id: string): StoredGame | undefined {
  const output = execFileSync(process.execPath, ["--import", "tsx", "tests/support/e2e-database.mts", action, id], { encoding: "utf8" });
  return action === "read" ? JSON.parse(output) : undefined;
}
function engineRows(id: string) { return database("read", id).moves.map(move => move.engineAnalysis); }
function annotationCount(id: string) { return database("read", id).moves.filter(move => move.coachingAnnotation).length; }
const ids: string[] = [];
const fixture = readFileSync("tests/fixtures/pgn/complete.pgn", "utf8");

test.afterEach(async () => {
  for (const id of ids.splice(0)) database("delete", id);
});

async function expectBoard(page: Page, fen: string) {
  const expected = new Chess(fen).board().flatMap(row => row.flatMap(piece =>
    piece ? [`${piece.square}:${piece.color}${piece.type.toUpperCase()}`] : [])).sort();
  // Read the rendered chessboard, not a FEN test attribute or a mocked component.
  await expect.poll(() => page.getByRole("img", { name: /Game position/ }).locator("[data-square] [data-piece]").evaluateAll(pieces =>
    pieces.map(piece => `${piece.closest("[data-square]")?.getAttribute("data-square")}:${piece.getAttribute("data-piece")}`).sort(),
  )).toEqual(expected);
}

for (const color of ["WHITE", "BLACK"] as const) {
  test(`${color}: validation, saved review, synchronized coaching and AI-only retry`, async ({ page }) => {
    if (color === "BLACK") await page.setViewportSize({ width: 390, height: 844 });
    const player = `E2E-${process.env.CHESS_E2E_RUN_ID}-${color}-${randomUUID()}`;
    await page.goto("/games/new");
    await page.getByLabel("Your color").selectOption(color);
    await page.getByLabel("Game PGN").fill("1. e5 *");
    await page.getByRole("button", { name: "Import and Analyze" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Your color")).toHaveValue(color);
    await expect(page.getByLabel("Game PGN")).toHaveValue("1. e5 *");
    await expect(page).toHaveURL(/\/games\/new$/);

    await page.getByLabel("Game PGN").fill(fixture.replace('[White "Aljaz"]', `[White "${player}"]`));
    await page.getByRole("button", { name: "Import and Analyze" }).click();
    await expect(page).toHaveURL(/\/games\/[a-z0-9-]{20,}(?:\?.*)?$/);
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    ids.push(id);
    await expect(page.getByRole("region", { name: "Game analysis" })).toContainText("AI service error. Engine review is available. Please retry.");
    await expect(page.getByText("Saved analysis: 10 of 10 moves.", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: `Game position, ${color === "WHITE" ? "White" : "Black"} at the bottom` })).toBeVisible();
    const engineBefore = engineRows(id);
    expect(engineBefore).toHaveLength(10);
    expect(annotationCount(id)).toBe(0);

    await page.reload();
    await expect(page.getByRole("button", { name: "Retry coaching", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Retry coaching", exact: true }).click();
    await expect(page.getByText("Deterministic coaching fixture: review candidate moves before committing.")).toBeVisible();
    const stored = database("read", id);
    expect(stored.userColor).toBe(color);
    expect(stored.analysisStatus).toBe("COMPLETED");
    expect(engineRows(id)).toEqual(engineBefore);
    const annotated = stored.moves.filter(move => move.coachingAnnotation);
    expect(annotated.length).toBeGreaterThan(0);
    expect(annotationCount(id)).toBe(annotated.length);

    const move = annotated.find(move => move.color === color)!;
    expect(move).toBeDefined();
    const direct = page.getByRole("table", { name: "Game moves" }).getByRole("button", { name: new RegExp(`^${move.moveNumber}\\. ${color === "WHITE" ? "White" : "Black"} ${move.san}`) });
    await direct.click();
    await expectBoard(page, move.fenAfter);
    await expect(direct).toHaveAttribute("aria-current", "step");
    const coaching = page.getByRole("region", { name: "Coaching", exact: true });
    await expect(coaching).toContainText(`Fixture lesson at ply ${move.ply}`);
    await expect(page.getByRole("region", { name: "Engine analysis" })).toContainText("50 cp");
    await expect(coaching).toContainText("position before the played move");

    const ordinary = stored.moves.find(move => !move.coachingAnnotation)!;
    await page.getByRole("table", { name: "Game moves" }).getByRole("button", { name: new RegExp(`^${ordinary.moveNumber}\\. ${ordinary.color === "WHITE" ? "White" : "Black"} ${ordinary.san}`) }).click();
    await expectBoard(page, ordinary.fenAfter);
    await expect(coaching).toContainText("This move has no coaching annotation");
    await expect(coaching).not.toContainText("Fixture lesson");

    await page.getByRole("navigation", { name: "Critical moves", exact: true }).getByRole("button", { name: `${move.moveNumber}${color === "WHITE" ? "." : "..."} ${move.san} · mistake`, exact: true }).click();
    await expectBoard(page, move.fenAfter);
    await expect(coaching).toContainText(`Fixture lesson at ply ${move.ply}`);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expectBoard(page, stored.initialFen);
    await page.getByRole("navigation", { name: "Annotated moments" }).getByRole("button", { name: `Go to move ${move.moveNumber}${color === "WHITE" ? "." : "…"} ${move.san} — mistake`, exact: true }).click();
    await expectBoard(page, move.fenAfter);
    await expect(coaching).toContainText(`Fixture lesson at ply ${move.ply}`);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expectBoard(page, stored.moves[move.ply].fenAfter);
    await page.keyboard.press("ArrowLeft");
    await expectBoard(page, move.fenAfter);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto("/games");
    await page.getByRole("link").filter({ hasText: player }).click();
    await expect(page).toHaveURL(new RegExp(`/games/${id}$`));
    await expect(page.getByText("Deterministic coaching fixture: review candidate moves before committing.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Saved analysis: 10 of 10 moves.", { exact: true })).toBeVisible();
    const conflict = await page.request.post(`/api/games/${id}/analyze`);
    expect(conflict.status()).toBe(409);
    expect(annotationCount(id)).toBe(annotated.length);
  });
}
