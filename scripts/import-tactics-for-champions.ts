import { Chess } from "chess.js";
import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { contentSchema, answerIdentity, validateContent, type LearningContent } from "../lib/learning/content";
import type { EngineInfo } from "../types/engine";

// One importer for every chapter of the book; each chapter lives in data/learning/tactics-for-champions/<slug>.json.
const MATERIAL = { title: "Chess Tactics for Champions", edition: "Susan Polgar" };
const USAGE = `Usage: node --conditions=react-server --import tsx scripts/import-tactics-for-champions.ts <command>
  init owner@example.com   create the private material when it does not exist yet
  check <chapter-slug>     validate the chapter file and compare each book move with Stockfish; no database writes
  import <chapter-slug>    validate, then create and publish the chapter's exercises`;

type Entry = { number: string; title: string; order: number; content: unknown; bookLines: string[]; analysisLines?: string[] };
type ChapterFile = { chapter: { title: string; order: number }; exercises: Entry[] };

async function readChapter(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Chapter slugs use lowercase letters, digits, and hyphens.");
  const file = JSON.parse(await readFile(new URL(`../data/learning/tactics-for-champions/${slug}.json`, import.meta.url), "utf8")) as ChapterFile;
  if (!file.chapter?.title || !Number.isInteger(file.chapter.order) || !file.exercises?.length) throw new Error("The chapter file needs a chapter title, order, and at least one exercise.");
  if (new Set(file.exercises.map(entry => entry.number)).size !== file.exercises.length) throw new Error("Exercise numbers must be unique within the chapter.");
  // Verify complete source continuations, including those beyond the trainer limit.
  const rows = file.exercises.map(entry => {
    const content = contentSchema.parse(entry.content);
    for (const line of [...entry.bookLines, ...(entry.analysisLines ?? [])]) {
      const board = new Chess(content.fen);
      for (const san of line.split(" ")) {
        if (board.move(san, { strict: true }).san !== san) throw new Error(`Exercise ${entry.number} has an incorrect SAN suffix or disambiguation: ${san}.`);
      }
    }
    const fullLine = entry.bookLines[0].split(" ");
    const practiceLength = Math.min(7, fullLine.length % 2 ? fullLine.length : fullLine.length - 1);
    if (content.solutionText.split("\n")[0] !== fullLine.slice(0, practiceLength).join(" ")) throw new Error(`Exercise ${entry.number} practice differs from its book line.`);
    try { validateContent(content); } catch (error) { throw new Error(`Exercise ${entry.number}: ${error instanceof Error ? error.message : "validation failed."}`); }
    return { number: entry.number, title: entry.title, order: entry.order, content };
  });
  return { chapter: file.chapter, rows };
}

/** Solver-relative centipawns; mates dominate any material score. */
function centipawns(info: EngineInfo | null, solverToMove: boolean) {
  if (!info) return null;
  const own = info.score.kind === "cp" ? info.score.value : Math.sign(info.score.value) * (100000 - Math.abs(info.score.value));
  return solverToMove ? own : -own;
}
const shown = (cp: number | null) => cp === null ? "?" : Math.abs(cp) > 90000 ? `${cp > 0 ? "" : "-"}#${100000 - Math.abs(cp)}` : (cp / 100).toFixed(2);

/** A misread diagram usually makes the book move legal but pointless; the engine comparison exposes that. */
async function engineCheck(rows: { number: string; content: LearningContent }[]) {
  const { createStockfish } = await import("../lib/engine/stockfish");
  const engine = createStockfish({ path: process.env.STOCKFISH_PATH ?? "", depth: 18, timeoutMs: 60_000 });
  let flagged = 0;
  for (const { number, content } of rows) {
    if (content.type !== "MOVE") { console.log(`${number.padStart(4)}  skipped (${content.type})`); continue; }
    const board = new Chess(content.fen);
    const start = await engine.analyze(content.fen);
    const best = centipawns(start.evaluation, true);
    const engineSan = start.bestMove ? new Chess(content.fen).move({ from: start.bestMove.slice(0, 2), to: start.bestMove.slice(2, 4), promotion: start.bestMove[4] }).san : "?";
    const bookSan = board.move(content.solutionText.split(/\s+/)[0], { strict: true }).san;
    const book = board.isCheckmate() ? 100000 : board.isGameOver() ? 0 : centipawns((await engine.analyze(board.fen())).evaluation, false);
    // Several winning moves are fine; only flag a book move that gives up the advantage.
    const suspect = best !== null && book !== null && best - book > 150 && book < 300;
    if (suspect) flagged++;
    console.log(`${number.padStart(4)}  book ${bookSan.padEnd(8)} ${shown(book).padStart(7)}   engine ${engineSan.padEnd(8)} ${shown(best).padStart(7)}${suspect ? "   <-- REVIEW" : ""}`);
  }
  console.log(flagged ? `${flagged} exercise(s) need review against the diagram.` : "Every book move holds up against Stockfish.");
  if (flagged) process.exitCode = 1;
}

async function main() {
  loadEnvConfig(process.cwd());
  const [command, argument, ...extra] = process.argv.slice(2);
  if (!["init", "check", "import"].includes(command) || !argument || extra.length) throw new Error(USAGE);
  if (command === "check") {
    const { chapter, rows } = await readChapter(argument);
    console.log(`${chapter.title}: ${rows.length} exercises pass legality and practice validation.`);
    return engineCheck(rows);
  }
  // Validate the entire batch before any database writes.
  const batch = command === "import" ? await readChapter(argument) : null;
  const { getDb } = await import("../lib/db/client");
  const { mutate } = await import("../lib/learning/repository");
  const db = getDb();
  try {
    const materials = await db.learningMaterial.findMany({ where: { title: MATERIAL.title, archived: false, shared: false }, include: { chapters: { include: { exercises: true } } } });
    if (materials.length > 1) throw new Error(`More than one active private material is titled “${MATERIAL.title}”; review them before importing.`);
    if (command === "init") {
      if (materials.length) { console.log(JSON.stringify({ materialId: materials[0].id, created: false, materialUrl: `/learning/${materials[0].id}` }, null, 2)); return; }
      const owner = await db.user.findUnique({ where: { email: argument } });
      if (!owner) throw new Error("No account uses that email address.");
      const { id } = await mutate(db, owner.id, { kind: "material", ...MATERIAL });
      console.log(JSON.stringify({ materialId: id, created: true, materialUrl: `/learning/${id}` }, null, 2)); return;
    }
    const material = materials[0];
    if (!material) throw new Error(`Create the material first with: init owner@example.com`);
    const { chapter, rows } = batch!;
    const chapters = material.chapters.filter(row => row.title === chapter.title);
    if (chapters.length > 1 || chapters[0]?.archived) throw new Error("The target chapter needs review before importing.");
    // Refuse to overwrite existing content or learner history on a rerun.
    for (const entry of rows) {
      const existing = chapters[0]?.exercises.find(exercise => exercise.number === entry.number);
      if (existing && (existing.archived || answerIdentity(contentSchema.parse(existing.draft)) !== answerIdentity(entry.content))) throw new Error(`Exercise ${entry.number} differs from this batch; review it before importing.`);
    }
    const chapterId = chapters[0]?.id ?? (await mutate(db, material.ownerId, { kind: "chapter", materialId: material.id, title: chapter.title, order: chapter.order })).id;
    let created = 0;
    for (const entry of rows) {
      let exercise = await db.learningExercise.findUnique({ where: { chapterId_number: { chapterId, number: entry.number } }, include: { published: true } });
      if (!exercise) {
        const added = await mutate(db, material.ownerId, { kind: "exercise", chapterId, ...entry });
        exercise = await db.learningExercise.findUniqueOrThrow({ where: { id: added.id }, include: { published: true } }); created++;
      }
      if (exercise.published && answerIdentity(contentSchema.parse(exercise.published.content)) === answerIdentity(entry.content)) continue;
      await mutate(db, material.ownerId, { kind: "validate", id: exercise.id, expectedRevision: exercise.revision });
      await mutate(db, material.ownerId, { kind: "publish", id: exercise.id, expectedRevision: exercise.revision + 1 });
    }
    const published = await db.learningExercise.count({ where: { chapterId, archived: false, publishedId: { not: null }, number: { in: rows.map(row => row.number) } } });
    console.log(JSON.stringify({ materialId: material.id, chapterId, exercises: rows.length, created, published, chapterUrl: `/learning/chapters/${chapterId}` }, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Import failed."); process.exitCode = 1; });
