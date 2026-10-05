import type { PrismaClient } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import { getProfile } from "@/lib/learning-profile/repository";
import { PlanError, type PlanInputs, type PlanResource } from "./contract";
export const MAX_PLAN_RESOURCES = 100;
const chapterPlayable = { archived: false, publishedId: { not: null } };
export async function planInputs(db: PrismaClient, userId: string): Promise<PlanInputs> {
  requireOwnerId(userId);
  const profile = await getProfile(db, userId);
  if (!profile) throw new PlanError("Save your learning profile before generating a weekly plan.", 409);
  const preferred = new Set(profile.answers.resources.map(r => `${r.kind}:${r.id}`));
  // Include preferred resources first, then a bounded selection of other available content.
  const visibleMaterial = { archived: false, OR: [{ ownerId: userId }, { shared: true }], chapters: { some: { archived: false, exercises: { some: chapterPlayable } } } };
  const [preferredBooks, otherBooks, preferredMaterials, otherMaterials, bookCount, materialCount, puzzleCount, gameCount] = await Promise.all([
    db.book.findMany({ where: { ownerId: userId, id: { in: profile.answers.resources.filter(r => r.kind === "book").map(r => r.id) } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.book.findMany({ where: { ownerId: userId, id: { notIn: profile.answers.resources.filter(r => r.kind === "book").map(r => r.id) } }, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }], take: MAX_PLAN_RESOURCES }),
    db.learningMaterial.findMany({ where: { ...visibleMaterial, id: { in: profile.answers.resources.filter(r => r.kind === "material").map(r => r.id) } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.learningMaterial.findMany({ where: { ...visibleMaterial, id: { notIn: profile.answers.resources.filter(r => r.kind === "material").map(r => r.id) } }, select: { id: true, title: true }, orderBy: [{ title: "asc" }, { id: "asc" }], take: MAX_PLAN_RESOURCES }),
    db.book.count({ where: { ownerId: userId } }), db.learningMaterial.count({ where: visibleMaterial }),
    db.personalPuzzle.count({ where: { generation: { game: { ownerId: userId } } } }), db.game.count({ where: { ownerId: userId } }),
  ]);
  const resources: PlanResource[] = [];
  if (puzzleCount) resources.push({ key: "puzzles", kind: "puzzles", id: null, title: `Your saved game puzzles (${puzzleCount})`, href: "/puzzles", preferred: profile.answers.activities.includes("Puzzles"), activities: ["Own-game puzzles", "Tactics"] });
  if (gameCount) resources.push({ key: "games", kind: "games", id: null, title: `Your saved games (${gameCount})`, href: "/games", preferred: profile.answers.activities.includes("Game review"), activities: ["Game review"] });
  const bookResource = (b: { id: string; name: string }): PlanResource => ({ key: `book:${b.id}`, kind: "book", id: b.id, title: b.name, href: "/books", preferred: preferred.has(`book:${b.id}`), activities: ["Reading", "Lessons", "Endgames"] });
  const materialResource = (m: { id: string; title: string }): PlanResource => ({ key: `material:${m.id}`, kind: "material", id: m.id, title: m.title, href: `/learning/${m.id}`, preferred: preferred.has(`material:${m.id}`), activities: ["Tactics", "Lessons"] });
  const base = [...preferredBooks.map(bookResource), ...preferredMaterials.map(materialResource), ...otherBooks.map(bookResource), ...otherMaterials.map(materialResource)].slice(0, MAX_PLAN_RESOURCES - resources.length);
  resources.push(...base);
  const materialIds = base.filter(r => r.kind === "material").map(r => r.id!);
  const chapterWhere = { archived: false, materialId: { in: materialIds }, exercises: { some: chapterPlayable } };
  const [chapters, chapterCount] = await Promise.all([
    db.learningChapter.findMany({ where: chapterWhere, orderBy: [{ materialId: "asc" }, { order: "asc" }, { id: "asc" }], take: Math.max(0, MAX_PLAN_RESOURCES - resources.length),
      select: { id: true, title: true, material: { select: { id: true, title: true } }, _count: { select: { exercises: { where: chapterPlayable } } } } }),
    db.learningChapter.count({ where: chapterWhere }),
  ]);
  resources.push(...chapters.map(c => ({ key: `chapter:${c.id}`, kind: "chapter" as const, id: c.id, title: `${c.material.title} / ${c.title}`, href: `/learning/chapters/${c.id}`, preferred: preferred.has(`material:${c.material.id}`), activities: ["Tactics", "Lessons"] as PlanResource["activities"], exerciseCount: c._count.exercises })));
  return { schemaVersion: 1, profile, resources, omittedResources: Math.max(0, bookCount + materialCount + chapterCount + (puzzleCount ? 1 : 0) + (gameCount ? 1 : 0) - resources.length), promptVersion: 1 };
}

type CatalogDb = Pick<PrismaClient, "book" | "learningMaterial" | "learningChapter" | "personalPuzzle" | "game">;

/** Check visibility again before edits/acceptance, in case a resource was removed. */
export async function currentResourceKeys(db: CatalogDb, userId: string, inputs: PlanInputs): Promise<Set<string>> {
  requireOwnerId(userId);
  const keys = new Set<string>();
  const books = await db.book.findMany({ where: { ownerId: userId, id: { in: inputs.resources.filter(r => r.kind === "book").map(r => r.id!) } }, select: { id: true } });
  const materials = await db.learningMaterial.findMany({ where: { id: { in: inputs.resources.filter(r => r.kind === "material").map(r => r.id!) }, archived: false, OR: [{ ownerId: userId }, { shared: true }], chapters: { some: { archived: false, exercises: { some: chapterPlayable } } } }, select: { id: true } });
  const chapters = await db.learningChapter.findMany({ where: { id: { in: inputs.resources.filter(r => r.kind === "chapter").map(r => r.id!) }, archived: false, material: { archived: false, OR: [{ ownerId: userId }, { shared: true }] }, exercises: { some: chapterPlayable } }, select: { id: true } });
  const puzzles = await db.personalPuzzle.count({ where: { generation: { game: { ownerId: userId } } } });
  const games = await db.game.count({ where: { ownerId: userId } });
  for (const b of books) keys.add(`book:${b.id}`);
  for (const m of materials) keys.add(`material:${m.id}`);
  for (const c of chapters) keys.add(`chapter:${c.id}`);
  if (puzzles) keys.add("puzzles"); if (games) keys.add("games");
  return keys;
}
