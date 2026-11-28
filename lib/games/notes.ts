import { z } from "zod";
import { requireOwnerId } from "@/lib/auth/owner";
import type { PrismaClient } from "@/generated/prisma/client";

export const NOTE_MAX_LENGTH = 4000;

/** `ply: null` addresses the note on the whole game. */
export const noteRequestSchema = z.object({ ply: z.number().int().positive().nullable(), text: z.string().max(NOTE_MAX_LENGTH) }).strict();

/** Save the owner's note on a game or one of its moves; blank text removes it. Returns undefined when there is no such game or move. */
export async function saveNote(db: PrismaClient, gameId: string, ownerId: string, ply: number | null, text: string): Promise<string | null | undefined> {
  const note = text.trim() || null;
  const game = { id: gameId, ownerId: requireOwnerId(ownerId) };
  const { count } = ply === null
    ? await db.game.updateMany({ where: game, data: { note } })
    : await db.gameMove.updateMany({ where: { ply, game }, data: { note } });
  return count ? note : undefined;
}
