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

test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { name: "Review tester", email: `e2e-${process.env.CHESS_E2E_RUN_ID}-${randomUUID()}@example.test`, password: "browser test passphrase" },
  });
  expect(response.status()).toBe(200);
});

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
    const provider = color === "WHITE" ? "ANTHROPIC" : "OPENAI";
    await page.goto("/settings");
    await page.getByLabel("Coaching provider").selectOption(provider);
    await page.getByRole("button", { name: "Save provider" }).click();
    await expect(page.getByRole("status")).toHaveText("Coaching provider saved.");
    await page.reload();
    await expect(page.getByLabel("Coaching provider")).toHaveValue(provider);
    await page.goto("/games/new");
    await page.getByLabel("Your color").selectOption(color);
    await page.getByLabel("Game PGN").fill("1. e5 *");
    await page.getByRole("button", { name: "Import and Analyze" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Your color")).toHaveValue(color);
    await expect(page.getByLabel("Game PGN")).toHaveValue("1. e5 *");
    await expect(page).toHaveURL(/\/games\/new$/);

    await page.getByLabel("Game PGN").fill(fixture.replace('[White "Aljaz"]', `[White "${player}"]`).replace('[Event "Local rapid"]', `[Event "Initial provider: ${provider}"]`));
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
    expect(stored.coachingProvider).toBe(provider);
    expect(stored.coachingModel).toBe(`e2e-${provider}-fixture`);
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
    await page.getByText("Engine details", { exact: true }).click();
    await expect(page.getByRole("region", { name: "Engine analysis" })).toContainText("50 cp");
    await expect(coaching).toContainText("position before the played move");

    const ordinary = stored.moves.find(move => !move.coachingAnnotation)!;
    await page.getByRole("table", { name: "Game moves" }).getByRole("button", { name: new RegExp(`^${ordinary.moveNumber}\\. ${ordinary.color === "WHITE" ? "White" : "Black"} ${ordinary.san}`) }).click();
    await expectBoard(page, ordinary.fenAfter);
    await expect(coaching).toContainText("This move has no coaching annotation");
    await expect(coaching).not.toContainText("Fixture lesson");

    await page.getByLabel("Filter moves").selectOption("mistake");
    await direct.click();
    await page.getByLabel("Filter moves").selectOption("all");
    await expectBoard(page, move.fenAfter);
    await expect(coaching).toContainText(`Fixture lesson at ply ${move.ply}`);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expectBoard(page, stored.initialFen);
    await page.getByText("Read full review", { exact: true }).click();
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
    const conflict = await page.request.post(`/api/games/${id}/analyze`, { headers: { origin: "http://127.0.0.1:3100" } });
    expect(conflict.status()).toBe(409);
    expect(annotationCount(id)).toBe(annotated.length);

    // Saving a different default does not mutate this completed review.
    const replacementProvider = provider === "ANTHROPIC" ? "OPENAI" : "ANTHROPIC";
    await page.goto("/settings");
    await page.getByLabel("Coaching provider").selectOption(replacementProvider);
    await page.getByRole("button", { name: "Save provider" }).click();
    await expect(page.getByRole("status")).toHaveText("Coaching provider saved.");
    expect(database("read", id).coachingProvider).toBe(provider);
    const originalAnnotations = database("read", id).moves.map(m => m.coachingAnnotation);
    await page.goto(`/games/${id}`);
    await page.getByText("Review options", { exact: true }).click();
    await page.getByText("Read full review", { exact: true }).click();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/api/games/${id}/coaching`) && response.request().method() === "POST"),
      page.getByRole("button", { name: "Regenerate coaching" }).click(),
    ]);
    await expect(page.getByRole("region", { name: "Game analysis" })).toContainText("AI service error");
    expect(database("read", id).moves.map(m => m.coachingAnnotation)).toEqual(originalAnnotations);
    expect(database("read", id).coachingProvider).toBe(provider);
    await expect(page.getByRole("button", { name: "Regenerate coaching" })).toBeEnabled();
    const staleRevision = database("read", id).coachingRevision;
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/api/games/${id}/coaching`) && response.request().method() === "POST"),
      page.getByRole("button", { name: "Regenerate coaching" }).click(),
    ]);
    await expect(page.getByText(`Coached by ${replacementProvider === "OPENAI" ? "OpenAI (GPT)" : "Anthropic (Claude)"} · e2e-${replacementProvider}-fixture`)).toBeVisible();
    const replaced = database("read", id);
    expect(replaced.coachingProvider).toBe(replacementProvider);
    expect(annotationCount(id)).toBe(1);
    expect(replaced.moves.filter(m => m.coachingAnnotation).every(m => m.coachingAnnotation?.provider === replacementProvider)).toBe(true);
    expect(engineRows(id)).toEqual(engineBefore);
    expect((await page.request.post(`/api/games/${id}/coaching`, { headers: { origin: "http://127.0.0.1:3100" }, data: { expectedRevision: staleRevision } })).status()).toBe(409);
    await page.reload();
    await page.getByText("Read full review", { exact: true }).click();
    await expect(page.getByText(`Coached by ${replacementProvider === "OPENAI" ? "OpenAI (GPT)" : "Anthropic (Claude)"} · e2e-${replacementProvider}-fixture`)).toBeVisible();
  });
}

test("unavailable provider shows configuration guidance and preserves engine review", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText(/OpenAI \(GPT\): Unavailable/)).toBeVisible();
  await page.getByLabel("Coaching provider").selectOption("OPENAI");
  await page.getByRole("button", { name: "Save provider" }).click();
  await expect(page.getByRole("status")).toHaveText("Coaching provider saved.");
  await page.goto("/games/new");
  await page.getByLabel("Your color").selectOption("WHITE");
  await page.getByLabel("Game PGN").fill(fixture.replace('[White "Aljaz"]', `[White "E2E-${process.env.CHESS_E2E_RUN_ID}-MISSING"]`).replace('[Event "Local rapid"]', '[Event "Missing-key fixture"]'));
  await page.getByRole("button", { name: "Import and Analyze" }).click();
  await expect(page).toHaveURL(/\/games\/[a-z0-9-]{20,}(?:\?.*)?$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  ids.push(id);
  await expect(page.getByRole("region", { name: "Game analysis" })).toContainText("OPENAI_API_KEY");
  await expect(page.getByText("Saved analysis: 10 of 10 moves.", { exact: true })).toBeVisible();
  expect(database("read", id).analysisStatus).toBe("ENGINE_COMPLETED");
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry coaching", exact: true })).toBeEnabled();
});
