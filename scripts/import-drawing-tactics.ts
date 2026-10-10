import { Chess } from "chess.js";
import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { contentSchema, answerIdentity, validateContent } from "../lib/learning/content";

async function main() {
  loadEnvConfig(process.cwd());
  const [materialId, ...extra] = process.argv.slice(2);
  if (!materialId || extra.length) throw new Error("Usage: node --conditions=react-server --import tsx scripts/import-drawing-tactics.ts material-id");
  const entries = JSON.parse(await readFile(new URL("../data/learning/drawing-tactics.json", import.meta.url), "utf8")) as { number: string; title: string; order: number; content: unknown; bookLines: string[]; analysisLines?: string[] }[];
  // Verify complete source continuations, including those beyond the trainer limit.
  for (const entry of entries) {
    const content = contentSchema.parse(entry.content);
    for (const line of [...entry.bookLines, ...(entry.analysisLines ?? [])]) {
      const board = new Chess(content.fen);
      for (const san of line.split(" ")) {
        if (board.move(san, { strict: true }).san !== san) throw new Error(`Exercise ${entry.number} has an incorrect SAN suffix or disambiguation: ${san}.`);
      }
    }
    const fullLine = entry.bookLines[0].split(" ");
    const practiceLength = Math.min(7, fullLine.length % 2 ? fullLine.length : fullLine.length - 1);
    if (content.solutionText !== fullLine.slice(0, practiceLength).join(" ")) throw new Error(`Exercise ${entry.number} practice differs from its book line.`);
  }
  // Validate the entire batch before any database writes.
  const rows = entries.map(entry => { const content = contentSchema.parse(entry.content); validateContent(content); return { number: entry.number, title: entry.title, order: entry.order, content }; });
  const { getDb } = await import("../lib/db/client");
  const { mutate } = await import("../lib/learning/repository");
  const db = getDb();
  try {
    const material = await db.learningMaterial.findFirst({ where: { id: materialId, archived: false, shared: false }, include: { chapters: { include: { exercises: true } } } });
    if (!material || material.title !== "1001 chess exercises for beginners") throw new Error("Select the existing private beginner book material.");
    const chapters = material.chapters.filter(chapter => chapter.title === "Drawing tactics");
    if (chapters.length > 1 || chapters[0]?.archived) throw new Error("The target chapter needs review before importing.");
    // Refuse to overwrite existing content or learner history on a rerun.
    for (const entry of rows) {
      const existing = chapters[0]?.exercises.find(exercise => exercise.number === entry.number);
      if (existing && (existing.archived || answerIdentity(contentSchema.parse(existing.draft)) !== answerIdentity(entry.content))) throw new Error(`Exercise ${entry.number} differs from this batch; review it before importing.`);
    }
    const chapterId = chapters[0]?.id ?? (await mutate(db, material.ownerId, { kind: "chapter", materialId, title: "Drawing tactics", order: 12 })).id;
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
    console.log(JSON.stringify({ materialId, chapterId, exercises: rows.length, created, published, chapterUrl: `/learning/chapters/${chapterId}` }, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Import failed."); process.exitCode = 1; });
