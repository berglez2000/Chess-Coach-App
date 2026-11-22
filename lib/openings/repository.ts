import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { matchingPositions, position, positionKey, validateContent, OpeningError, type OpeningContent } from "./content";
export type OpeningDto = OpeningContent & { id: string; revision: number; videos: { id: string; name: string; size: number }[] };
export type RelatedGame = { id: string; whiteName: string | null; blackName: string | null; result: string };
export type OpeningSummary = { id: string; name: string; description: string; color: OpeningContent["color"]; count: number; videos: number; plies: number; preview: { fen: string; moves: string; line: string | null } };
const PREVIEW_PLIES = 8;
/** Position and numbered SAN after the first few moves of the first variation; falls back to the starting position. */
function preview(startFen: string, lines: OpeningContent["lines"]) {
  const line = lines[0];
  try {
    const chess = position(startFen);
    const parts: string[] = [];
    (line?.moves.slice(0, PREVIEW_PLIES) ?? []).forEach((uci, index) => {
      const number = chess.moveNumber();
      const white = chess.turn() === "w";
      const san = chess.move(uci).san;
      parts.push(white ? `${number}. ${san}` : index === 0 ? `${number}… ${san}` : san);
    });
    const more = line && line.moves.length > PREVIEW_PLIES;
    return { fen: chess.fen(), moves: parts.join(" ") + (more ? " …" : ""), line: line?.name ?? null };
  } catch {
    return { fen: startFen, moves: "", line: line?.name ?? null };
  }
}
export function openingRepository(db: PrismaClient, ownerId: string) {
  async function get(id: string): Promise<OpeningDto> {
    const row = await db.opening.findFirst({ where: { id, ownerId }, include: { videos: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, size: true } } } });
    if (!row) throw new OpeningError("Opening not found.", 404);
    return { id: row.id, revision: row.revision, name: row.name, description: row.description, color: row.color, startFen: row.startFen, lines: row.lines as OpeningContent["lines"], videos: row.videos };
  }
  return {
    get,
    async list(): Promise<OpeningSummary[]> {
      const rows = await db.opening.findMany({ where: { ownerId }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: { id: true, name: true, description: true, color: true, startFen: true, lines: true, _count: { select: { videos: true } } } });
      return rows.map(row => {
        const lines = row.lines as OpeningContent["lines"];
        return { id: row.id, name: row.name, description: row.description, color: row.color, count: lines.length, videos: row._count.videos, plies: lines.reduce((sum, line) => sum + line.moves.length, 0), preview: preview(row.startFen, lines) };
      });
    },
    async create(input: unknown) {
      const content = validateContent(input);
      const row = await db.opening.create({ data: { ...content, ownerId } });
      return get(row.id);
    },
    async update(id: string, revision: number, input: unknown) {
      const content = validateContent(input);
      await get(id);
      const result = await db.opening.updateMany({ where: { id, ownerId, revision }, data: { ...content, revision: { increment: 1 } } });
      if (!result.count) throw new OpeningError("This opening changed in another tab. Copy your work before reloading the latest version.", 409);
      return get(id);
    },
    async related(id: string): Promise<RelatedGame[]> {
      const content = await get(id);
      const keys = matchingPositions(content);
      if (!keys.size) return [];
      // Scan only the owner's opening moves, never another account's positions or PGN.
      const moves = await db.gameMove.findMany({ where: { game: { ownerId }, ply: { lte: 40 } }, select: { gameId: true, fenBefore: true, fenAfter: true } });
      const ids = new Set<string>();
      for (const move of moves) { if (keys.has(positionKey(move.fenBefore)) || keys.has(positionKey(move.fenAfter))) ids.add(move.gameId); }
      return db.game.findMany({ where: { ownerId, id: { in: [...ids] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, select: { id: true, whiteName: true, blackName: true, result: true } });
    },
    async video(id: string, videoId: string) {
      const row = await db.openingVideo.findFirst({ where: { id: videoId, openingId: id, opening: { ownerId } } });
      if (!row) throw new OpeningError("Video not found.", 404);
      return row;
    },
    async addVideo(id: string, video: { id: string; name: string; size: number }) {
      // Serialize with opening edits; recheck ownership in the transaction.
      return db.$transaction(async tx => {
        const changed = await tx.opening.updateMany({ where: { id, ownerId }, data: { updatedAt: new Date() } });
        if (!changed.count) throw new OpeningError("Opening not found.", 404);
        return tx.openingVideo.create({ data: { ...video, openingId: id } });
      });
    },
    async deleteVideo(id: string, videoId: string) {
      await db.openingVideo.deleteMany({ where: { id: videoId, openingId: id, opening: { ownerId } } });
    },
  };
}
