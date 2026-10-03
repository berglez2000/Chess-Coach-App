import type { LearningProgress, PrismaClient, Prisma } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import { z } from "zod";
import { answerIdentity, contentSchema, LearningError, SAMPLE_CONTENT, validateContent, type Validation } from "./content";
import { applyPuzzleAction, INITIAL_PROGRESS, solverDto, type PuzzleDefinition } from "@/lib/puzzles/solve";
import type { PuzzleAction, PuzzleState } from "@/types/puzzle";

const text = z.string().trim().min(1).max(200);
const id = z.string().min(1).max(100);
const edit = { id: id.optional(), expectedRevision: z.number().int().min(0).default(0) };
export const mutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("material"), ...edit, title: text, edition: z.string().max(200).default(""), archived: z.boolean().default(false) }).strict(),
  z.object({ kind: z.literal("chapter"), ...edit, materialId: id, title: text, order: z.number().int().min(0).max(100000), archived: z.boolean().default(false) }).strict(),
  z.object({ kind: z.literal("exercise"), ...edit, chapterId: id, number: text, title: text, order: z.number().int().min(0).max(100000), archived: z.boolean().default(false), content: contentSchema }).strict(),
  z.object({ kind: z.enum(["validate", "publish"]), id, expectedRevision: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal("sample") }).strict(),
]);
const visible = (userId: string) => ({ archived: false, OR: [{ ownerId: requireOwnerId(userId) }, { shared: true }] });
const json = (value: unknown) => value as Prisma.InputJsonValue;
const conflict = () => { throw new LearningError("This content changed in another request. Reload before saving.", 409); };
const missing = () => { throw new LearningError("Learning content not found.", 404); };

export async function library(db: PrismaClient, userId: string) {
  return db.learningMaterial.findMany({ where: visible(userId), orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { chapters: { where: { archived: false }, orderBy: [{ order: "asc" }, { id: "asc" }],
      include: { exercises: { where: { archived: false, OR: [{ chapter: { material: { ownerId: userId, shared: false } } }, { publishedId: { not: null } }] }, orderBy: [{ order: "asc" }, { id: "asc" }],
        select: { id: true, number: true, title: true, revision: true, order: true, status: true,
          published: { select: { id: true, version: true, progress: { where: { userId }, select: { state: true, completedAt: true, completionAssisted: true } } } } } } } } } });
}
export async function editorExercise(db: PrismaClient, userId: string, exerciseId: string) {
  return db.learningExercise.findFirst({ where: { id: exerciseId, chapter: { material: { ownerId: requireOwnerId(userId), shared: false } } },
    include: { chapter: { include: { material: true } } } });
}
export async function mutate(db: PrismaClient, userId: string, raw: unknown) {
  requireOwnerId(userId); const input = mutationSchema.parse(raw);
  if (input.kind === "sample") {
    // Serialize sample creation by locking the owning user; repeated requests never duplicate it.
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const existing = await tx.learningMaterial.findFirst({ where: { ownerId: userId, title: "1001 chess exercises for beginners", edition: "User-supplied sample" } });
      if (existing) {
        if (existing.archived) throw new LearningError("The sample material is archived. Its history is preserved; create a new material to continue studying.");
        return { id: existing.id, materialId: existing.id };
      }
      const validation = validateContent(SAMPLE_CONTENT);
      const material = await tx.learningMaterial.create({ data: { ownerId: userId, title: "1001 chess exercises for beginners", edition: "User-supplied sample",
        chapters: { create: { title: "Mate in One", exercises: { create: { number: "1", title: "The pin is mightier than the sword", draft: json(SAMPLE_CONTENT), status: "VALIDATED", validation: json(validation) } } } } },
        include: { chapters: { include: { exercises: true } } } });
      const exercise = material.chapters[0].exercises[0];
      const version = await tx.learningRevision.create({ data: { exerciseId: exercise.id, version: 1, content: json(SAMPLE_CONTENT), validation: json(validation) } });
      await tx.learningExercise.update({ where: { id: exercise.id }, data: { publishedId: version.id, status: "PUBLISHED" } });
      return { id: material.id, materialId: material.id };
    });
  }
  if (input.kind === "material") {
    if (!input.id) { const row = await db.learningMaterial.create({ data: { ownerId: userId, title: input.title, edition: input.edition } }); return { id: row.id, materialId: row.id }; }
    const exists = await db.learningMaterial.findFirst({ where: { id: input.id, ownerId: userId, shared: false } }); if (!exists) missing();
    const result = await db.learningMaterial.updateMany({ where: { id: input.id, ownerId: userId, shared: false, revision: input.expectedRevision },
      data: { title: input.title, edition: input.edition, archived: input.archived, revision: { increment: 1 } } });
    if (!result.count) conflict(); return { id: input.id, materialId: input.id };
  }
  if (input.kind === "chapter") {
    return db.$transaction(async tx => {
      const material = await tx.learningMaterial.findFirst({ where: { id: input.materialId, ownerId: userId, shared: false, archived: false } }); if (!material) missing();
      if (!input.id) { const row = await tx.learningChapter.create({ data: { materialId: input.materialId, title: input.title, order: input.order } }); return { id: row.id, materialId: input.materialId }; }
      const row = await tx.learningChapter.findFirst({ where: { id: input.id, materialId: input.materialId } }); if (!row) missing();
      const result = await tx.learningChapter.updateMany({ where: { id: input.id, materialId: input.materialId, revision: input.expectedRevision }, data: { title: input.title, order: input.order, archived: input.archived, revision: { increment: 1 } } });
      if (!result.count) conflict(); return { id: input.id, materialId: input.materialId };
    });
  }
  if (input.kind === "exercise") {
    return db.$transaction(async tx => {
      const chapter = await tx.learningChapter.findFirst({ where: { id: input.chapterId, archived: false, material: { ownerId: userId, shared: false, archived: false } } }); if (!chapter) missing();
      if (input.content.pdfId && !await tx.book.findFirst({ where: { id: input.content.pdfId, ownerId: userId } })) throw new LearningError("Choose a PDF owned by your account.");
      const data = { number: input.number, title: input.title, order: input.order, archived: input.archived, draft: json(input.content) };
      if (!input.id) { const row = await tx.learningExercise.create({ data: { chapterId: input.chapterId, ...data } }); return { id: row.id, materialId: chapter!.materialId }; }
      const row = await tx.learningExercise.findFirst({ where: { id: input.id, chapterId: input.chapterId } }); if (!row) missing();
      const changed = answerIdentity(contentSchema.parse(row!.draft)) !== answerIdentity(input.content);
      const result = await tx.learningExercise.updateMany({ where: { id: input.id, chapterId: input.chapterId, revision: input.expectedRevision }, data: { ...data, revision: { increment: 1 },
        ...(changed ? { status: "DRAFT", validation: { fingerprint: "" } } : {}) } });
      if (!result.count) conflict(); return { id: input.id, materialId: chapter!.materialId };
    });
  }
  const exercise = await editorExercise(db, userId, input.id); if (!exercise) return missing();
  if (exercise.revision !== input.expectedRevision) conflict();
  const content = contentSchema.parse(exercise.draft);
  if (input.kind === "validate") {
    const validation = validateContent(content);
    const result = await db.learningExercise.updateMany({ where: { id: input.id, revision: input.expectedRevision, chapter: { material: { ownerId: userId, shared: false } } }, data: { validation: json(validation), status: "VALIDATED", revision: { increment: 1 } } });
    if (!result.count) conflict(); return { id: input.id, materialId: exercise.chapter.materialId };
  }
  return db.$transaction(async tx => {
    // Claim the content row before creating the immutable revision.
    const claim = await tx.learningExercise.updateMany({ where: { id: input.id, revision: input.expectedRevision, chapter: { material: { ownerId: userId, shared: false, archived: false }, archived: false } }, data: { revision: { increment: 1 } } });
    if (!claim.count) conflict();
    const row = await tx.learningExercise.findUniqueOrThrow({ where: { id: input.id }, include: { published: true } });
    const validation = row.validation as unknown as Validation | null;
    if (!validation?.solution || validation.fingerprint !== answerIdentity(content)) throw new LearningError("Validate this draft before publishing.");
    if (content.type !== "MOVE" || row.archived) throw new LearningError("Only active validated move exercises can be published.");
    if (row.published && answerIdentity(contentSchema.parse(row.published.content)) === answerIdentity(content)) {
      await tx.learningExercise.update({ where: { id: row.id }, data: { status: "PUBLISHED" } });
    } else {
      const latest = await tx.learningRevision.aggregate({ where: { exerciseId: row.id }, _max: { version: true } });
      const version = await tx.learningRevision.create({ data: { exerciseId: row.id, version: (latest._max.version ?? 0) + 1, content: json(content), validation: json(validation) } });
      await tx.learningExercise.update({ where: { id: row.id }, data: { publishedId: version.id, status: "PUBLISHED" } });
    }
    return { id: row.id, materialId: exercise.chapter.materialId };
  });
}
function progress(row?: LearningProgress | null): PuzzleState {
  return row ? { revision: row.revision, state: row.state as PuzzleState["state"], assisted: row.assisted, hintUsed: row.hintUsed,
    solvedMove: row.solvedMove, playedMoves: row.playedMoves, lastOutcome: row.lastOutcome, moveAttempts: row.moveAttempts,
    completedAt: row.completedAt?.toISOString() ?? null, completionAssisted: row.completionAssisted } : { ...INITIAL_PROGRESS };
}
function definition(id: string, content: unknown, validation: unknown): PuzzleDefinition {
  const parsed = contentSchema.parse(content); const checked = validation as unknown as Validation;
  return { id, startingFen: parsed.fen, playerColor: parsed.solver, sourcePly: 0, generation: { gameId: "" }, acceptedMoves: checked.acceptedMoves, solution: checked.solution };
}
function dto(id: string, revisionId: string, content: unknown, validation: unknown, saved: PuzzleState) {
  const parsed = contentSchema.parse(content);
  return { ...solverDto(definition(id, content, validation), saved), learning: { revisionId,
    objective: parsed.objective === "MATE" ? `Mate in ${parsed.mateIn}` : "Play the authored tactical sequence",
    prompt: parsed.prompt, hint: saved.hintUsed ? parsed.hint : null,
    publishedSolution: saved.state !== "SOLVING" ? parsed.solutionText : null,
    explanation: saved.state !== "SOLVING" ? parsed.explanation : null } };
}
const revisionAccess = (userId: string, exerciseId: string, revisionId?: string) => ({
  ...(revisionId ? { id: revisionId } : { currentFor: { id: exerciseId } }),
  exerciseId, exercise: { chapter: { material: visible(userId), archived: false }, archived: false },
  ...(revisionId ? { OR: [{ currentFor: { id: exerciseId } }, { progress: { some: { userId } } }] } : {}),
});
export async function practice(db: PrismaClient, userId: string, exerciseId: string, revisionId?: string) {
  const row = await db.learningRevision.findFirst({ where: revisionAccess(userId, exerciseId, revisionId), include: { progress: { where: { userId } } } });
  return row ? dto(exerciseId, row.id, row.content, row.validation, progress(row.progress[0])) : null;
}
export async function act(db: PrismaClient, userId: string, exerciseId: string, revisionId: string, action: PuzzleAction) {
  requireOwnerId(userId);
  return db.$transaction(async tx => {
    const row = await tx.learningRevision.findFirst({ where: revisionAccess(userId, exerciseId, revisionId) }); if (!row) return { status: "NOT_FOUND" as const };
    await tx.learningProgress.createMany({ data: [{ revisionId: row.id, userId }], skipDuplicates: true });
    const saved = await tx.learningProgress.findUniqueOrThrow({ where: { revisionId_userId: { revisionId: row.id, userId } } });
    const duplicate = () => tx.learningAttempt.findUnique({ where: { progressId_requestId: { progressId: saved.id, requestId: action.requestId } } });
    const replay = async (existing: NonNullable<Awaited<ReturnType<typeof duplicate>>>) => {
      const current = await tx.learningProgress.findUniqueOrThrow({ where: { id: saved.id } });
      const same = existing.action === action.action && existing.expectedRevision === action.expectedRevision && existing.move === (action.action === "MOVE" ? action.move : null);
      return { status: same ? "OK" as const : "CONFLICT" as const, puzzle: dto(exerciseId, row.id, row.content, row.validation, progress(current)) };
    };
    const previous = await duplicate(); if (previous) return replay(previous);
    const claimed = await tx.learningProgress.updateMany({ where: { id: saved.id, userId, revision: action.expectedRevision }, data: { revision: { increment: 1 } } });
    if (!claimed.count) {
      const raced = await duplicate(); if (raced) return replay(raced);
      const current = await tx.learningProgress.findUniqueOrThrow({ where: { id: saved.id } });
      return { status: "CONFLICT" as const, puzzle: dto(exerciseId, row.id, row.content, row.validation, progress(current)) };
    }
    let next = applyPuzzleAction(definition(exerciseId, row.content, row.validation), { ...progress(saved), revision: action.expectedRevision }, action);
    if (next.lastOutcome === "INCORRECT" && contentSchema.parse(row.content).objective === "SEQUENCE") next = { ...next, lastOutcome: "UNSUPPORTED" };
    await tx.learningProgress.update({ where: { id: saved.id }, data: { ...next, completedAt: next.completedAt ? new Date(next.completedAt) : null } });
    await tx.learningAttempt.create({ data: { progressId: saved.id, requestId: action.requestId, expectedRevision: action.expectedRevision, action: action.action,
      move: action.action === "MOVE" ? action.move : null, outcome: next.lastOutcome!, assisted: next.assisted } });
    return { status: "OK" as const, puzzle: dto(exerciseId, row.id, row.content, row.validation, next) };
  });
}
