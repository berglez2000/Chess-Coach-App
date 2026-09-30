import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "@/generated/prisma/client";

/** Local operator operation only. Never expose through a web endpoint. */
export async function claimLegacyGames(db: PrismaClient, email: string) {
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) throw new Error("Register the target account before assigning legacy data.");
    const active = await tx.game.count({ where: { ownerId: null, analysisStatus: { in: ["ENGINE_RUNNING", "AI_RUNNING"] } } });
    if (active) throw new Error("Legacy analysis is unfinished. Finish or recover it before assigning data.");
    const legacy = await tx.appSettings.findUnique({ where: { id: "local" } });
    if (legacy) await tx.userSettings.upsert({ where: { userId: user.id },
      create: { userId: user.id, coachingProvider: legacy.coachingProvider }, update: {} });
    return (await tx.game.updateMany({ where: { ownerId: null }, data: { ownerId: user.id } })).count;
  });
}

/** Replaces only the credential hash; user ID and all game data stay intact. */
export async function resetLocalPassword(db: PrismaClient, email: string, password: string) {
  if (password.length < 12 || password.length > 128) throw new Error("Use a password of 12–128 characters.");
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (!user) throw new Error("No account found for that email.");
  const hash = await hashPassword(password);
  await db.$transaction(async tx => {
    const result = await tx.account.updateMany({ where: { userId: user.id, providerId: "credential" }, data: { password: hash } });
    if (result.count !== 1) throw new Error("The account has no unique email/password credential.");
    await tx.session.deleteMany({ where: { userId: user.id } });
  });
}
