import { requireOwnerId } from "@/lib/auth/owner";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ImportRepository } from "./import-game";

export function createImportRepository(db: PrismaClient, ownerId: string | null = null): ImportRepository {
  return {
    create(game, userColor) {
      // Prisma nested writes commit the game and every move atomically.
      return db.game.create({
        data: {
          ownerId: ownerId === null ? null : requireOwnerId(ownerId),
          pgn: game.pgn,
          initialFen: game.initialFen,
          ...game.metadata,
          playedAt: game.metadata.playedAt ? new Date(game.metadata.playedAt) : null,
          userColor,
          analysisStatus: "PENDING",
          moves: { create: game.moves },
        },
        select: { id: true },
      });
    },
  };
}
