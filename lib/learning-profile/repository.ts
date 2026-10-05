import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import { answersSchema, saveProfileSchema, type ResourceOption, type SavedProfile } from "./contract";

export class ProfileError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function resourceOptions(db: PrismaClient, userId: string): Promise<ResourceOption[]> {
  requireOwnerId(userId);
  const [books, materials] = await Promise.all([
    db.book.findMany({ where: { ownerId: userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.learningMaterial.findMany({ where: { archived: false, OR: [{ ownerId: userId }, { shared: true }] }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return [...books.map(b => ({ kind: "book" as const, id: b.id, title: b.name })), ...materials.map(m => ({ kind: "material" as const, id: m.id, title: m.title }))];
}
function dto(row: { id: string; revision: number; answers: Prisma.JsonValue; resourceTitles: Prisma.JsonValue; createdAt: Date }): SavedProfile {
  return { id: row.id, revision: row.revision, answers: answersSchema.parse(row.answers), resourceTitles: row.resourceTitles as ResourceOption[], savedAt: row.createdAt.toISOString() };
}
export async function getProfile(db: PrismaClient, userId: string) {
  const row = await db.learningProfileRevision.findFirst({ where: { userId: requireOwnerId(userId) }, orderBy: { revision: "desc" } });
  return row ? dto(row) : null;
}
export async function saveProfile(db: PrismaClient, userId: string, raw: unknown): Promise<SavedProfile> {
  requireOwnerId(userId);
  const input = saveProfileSchema.parse(raw);
  return db.$transaction(async tx => {
    // Serialize first saves as well as edits; retain immutable inputs for future plans.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const current = await tx.learningProfileRevision.findFirst({ where: { userId }, orderBy: { revision: "desc" } });
    if ((current?.revision ?? 0) !== input.expectedRevision) {
      if (current && JSON.stringify(answersSchema.parse(current.answers)) === JSON.stringify(input.answers)) return dto(current);
      throw new ProfileError("Your learning profile changed in another tab. Reload to review the latest answers before saving.", 409);
    }
    const resources: ResourceOption[] = [];
    for (const resource of input.answers.resources) {
      const row = resource.kind === "book"
        ? await tx.book.findFirst({ where: { id: resource.id, ownerId: userId }, select: { name: true } })
        : await tx.learningMaterial.findFirst({ where: { id: resource.id, archived: false, OR: [{ ownerId: userId }, { shared: true }] }, select: { title: true } });
      if (!row) throw new ProfileError("A selected resource is no longer available. Reload and update your selection.");
      resources.push({ ...resource, title: "name" in row ? row.name : row.title });
    }
    const row = await tx.learningProfileRevision.create({ data: { userId, revision: input.expectedRevision + 1,
      answers: input.answers as Prisma.InputJsonValue, resourceTitles: resources as Prisma.InputJsonValue } });
    return dto(row);
  });
}
