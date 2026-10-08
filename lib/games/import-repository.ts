import { requireOwnerId } from "@/lib/auth/owner";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ImportRepository } from "./import-game";

export function createImportRepository(db: PrismaClient, ownerId: string | null = null): ImportRepository {
  return {
    async create(game, userColor, recordingId) {
      const owner = ownerId === null ? null : requireOwnerId(ownerId);
      // Stable owner-scoped primary key provides atomic retry protection without a migration.
      const id = recordingId && owner ? `recording_${createHash("sha256").update(JSON.stringify([owner, recordingId])).digest("hex")}` : undefined;
      const existing = async () => {
        if (!id) return null;
        const saved = await db.game.findUnique({ where: { id }, select: { id: true, ownerId: true, pgn: true, userColor: true } });
        if (saved && (saved.ownerId !== owner || saved.pgn !== game.pgn || saved.userColor !== userColor)) {
          throw new Error("Recording snapshot differs from the saved game.");
        }
        return saved ? { id: saved.id } : null;
      };
      const saved = await existing();
      if (saved) return saved;
      // Prisma nested writes commit the game and every move atomically.
      const metadata = { ...game.metadata };
      delete metadata.whiteRating;
      delete metadata.blackRating;
      try { return await db.game.create({
        data: {
          ...(id ? { id } : {}),
          ownerId: owner,
          pgn: game.pgn,
          initialFen: game.initialFen,
          ...metadata,
          playedAt: game.metadata.playedAt ? new Date(game.metadata.playedAt) : null,
          userColor,
          analysisStatus: "PENDING",
          moves: { create: game.moves.map(source => { const move = { ...source }; delete move.clockSeconds; return move; }) },
        },
        select: { id: true },
      }); } catch (error) {
        // A concurrent retry may win the unique primary-key insert.
        if (id && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
          const winner = await existing();
          if (winner) return winner;
        }
        throw error;
      }
    },
  };
}
