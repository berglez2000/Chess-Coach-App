import { Chess } from "chess.js";
import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import type { Prisma } from "../generated/prisma/client";
import { readSolution } from "../lib/puzzles/sequence";
import { contentSchema, answerIdentity, validateContent, type Validation } from "../lib/learning/content";

async function main() {
  loadEnvConfig(process.cwd());
  const [materialId, validationCachePath, ...extra] = process.argv.slice(2);
  if (!materialId || extra.length) throw new Error("Usage: node --conditions=react-server --import tsx scripts/import-mate-three.ts material-id [offline-validation-cache]");
  const entries = JSON.parse(await readFile(new URL("../data/learning/mate-in-three.json", import.meta.url), "utf8")) as { number: string; title: string; order: number; content: unknown; bookLines: string[]; analysisLines?: string[] }[];
  if (entries.length !== 81 || entries.some((entry, index) => entry.number !== String(865 + index) || entry.order !== 865 + index)) throw new Error("Expected all 81 exercises, numbered 865–945 in order.");
  // Verify complete source continuations, including those beyond the trainer limit.
  for (const entry of entries) {
    const content = contentSchema.parse(entry.content);
    for (const line of [...entry.bookLines, ...(entry.analysisLines ?? [])]) {
      const board = new Chess(content.fen);
      for (const san of line.split(" ")) {
        if (board.move(san, { strict: true }).san !== san) throw new Error(`Exercise ${entry.number} has an incorrect SAN suffix or disambiguation: ${san}.`);
      }
    }
  }
  // Validate the entire batch before any database writes.
  const cached = validationCachePath ? JSON.parse(await readFile(validationCachePath, "utf8")) as Record<string, Validation> : {};
  const rows = entries.map(entry => {
    const content = contentSchema.parse(entry.content);
    const validation = cached[entry.number] ?? validateContent(content, { nodes: 2000000, milliseconds: 300000 });
    if (validation.method !== "exhaustive-forced-mate-v1" || validation.fingerprint !== answerIdentity(content)) throw new Error(`Exercise ${entry.number} has a stale offline proof.`);
    readSolution(validation.solution, content.fen, validation.acceptedMoves, content.solver);
    return { number: entry.number, title: entry.title, order: entry.order, content, validation };
  });
  const { getDb } = await import("../lib/db/client");
  const { mutate } = await import("../lib/learning/repository");
  const db = getDb();
  try {
    const material = await db.learningMaterial.findFirst({ where: { id: materialId, archived: false, shared: false }, include: { chapters: { include: { exercises: true } } } });
    if (!material || material.title !== "1001 chess exercises for beginners") throw new Error("Select the existing private beginner book material.");
    const chapters = material.chapters.filter(chapter => chapter.title === "Mate in 3");
    if (chapters.length > 1 || chapters[0]?.archived) throw new Error("The target chapter needs review before importing.");
    // Refuse to overwrite existing content or learner history on a rerun.
    for (const entry of rows) {
      const existing = chapters[0]?.exercises.find(exercise => exercise.number === entry.number);
      if (existing && (existing.archived || answerIdentity(contentSchema.parse(existing.draft)) !== answerIdentity(entry.content))) throw new Error(`Exercise ${entry.number} differs from this batch; review it before importing.`);
    }
    const chapterId = chapters[0]?.id ?? (await mutate(db, material.ownerId, { kind: "chapter", materialId, title: "Mate in 3", order: 15 })).id;
    let created = 0;
    for (const entry of rows) {
      let exercise = await db.learningExercise.findUnique({ where: { chapterId_number: { chapterId, number: entry.number } }, include: { published: true } });
      if (!exercise) {
        const added = await mutate(db, material.ownerId, { kind: "exercise", chapterId, number: entry.number, title: entry.title, order: entry.order, content: entry.content });
        exercise = await db.learningExercise.findUniqueOrThrow({ where: { id: added.id }, include: { published: true } }); created++;
      }
      if (exercise.published && answerIdentity(contentSchema.parse(exercise.published.content)) === answerIdentity(entry.content)) continue;
      const checked = await db.learningExercise.updateMany({
        where: { id: exercise.id, revision: exercise.revision, chapter: { material: { ownerId: material.ownerId, shared: false, archived: false } } },
        data: { validation: entry.validation as unknown as Prisma.InputJsonValue, status: "VALIDATED", revision: { increment: 1 } },
      });
      if (checked.count !== 1) throw new Error(`Exercise ${entry.number} changed during validation.`);
      await mutate(db, material.ownerId, { kind: "publish", id: exercise.id, expectedRevision: exercise.revision + 1 });
    }
    const published = await db.learningExercise.count({ where: { chapterId, archived: false, publishedId: { not: null }, number: { in: rows.map(row => row.number) } } });
    if (published !== rows.length) throw new Error("The chapter has an unexpected published exercise count.");
    console.log(JSON.stringify({ materialId, chapterId, exercises: rows.length, created, published, chapterUrl: `/learning/chapters/${chapterId}` }, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Import failed."); process.exitCode = 1; });
