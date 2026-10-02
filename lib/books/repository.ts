import "server-only";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { BookAction, BookSummary, ReaderBook } from "./contract";
import { BookError } from "./pdf";

const summarySelect = { id: true, name: true, totalPages: true, currentPage: true, revision: true, createdAt: true, lastRead: true, thumbnail: true } as const;
const readerSelect = { ...summarySelect, marks: { select: { id: true, page: true, x: true, y: true }, orderBy: { id: "asc" as const } } } as const;
type SummaryRow = { id: string; name: string; totalPages: number; currentPage: number; revision: number; createdAt: Date; lastRead: Date | null; thumbnail: Uint8Array | null };
function summary(row: SummaryRow): BookSummary {
  const { thumbnail, ...rest } = row;
  return { ...rest, createdAt: row.createdAt.toISOString(), lastRead: row.lastRead?.toISOString() ?? null, hasThumbnail: thumbnail !== null };
}
function reader(row: SummaryRow & { marks: ReaderBook["marks"] }): ReaderBook { return { ...summary(row), marks: row.marks }; }

export function booksRepository(db: PrismaClient, ownerId: string) {
  if (!ownerId) throw new Error("Book ownership is required.");
  return {
    async list() {
      return (await db.book.findMany({ where: { ownerId }, select: summarySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })).map(summary);
    },
    async get(id: string) {
      const row = await db.book.findFirst({ where: { id, ownerId }, select: readerSelect });
      return row ? reader(row) : null;
    },
    async file(id: string, thumbnail = false) {
      const row = await db.book.findFirst({ where: { id, ownerId }, select: thumbnail ? { thumbnail: true } : { pdf: true } });
      return row ? (thumbnail ? row.thumbnail : row.pdf) : null;
    },
    async create(name: string, pdf: Uint8Array<ArrayBuffer>, totalPages: number, thumbnail: Uint8Array<ArrayBuffer> | null) {
      const digest = createHash("sha256").update(pdf).digest("hex");
      // Re-importing the same file preserves all existing reading state.
      return reader(await db.book.upsert({ where: { ownerId_digest: { ownerId, digest } },
        create: { ownerId, name, pdf, digest, totalPages, thumbnail }, update: {}, select: readerSelect }));
    },
    async remove(id: string) { return (await db.book.deleteMany({ where: { id, ownerId } })).count > 0; },
    async change(id: string, action: BookAction) {
      return db.$transaction(async tx => {
        const book = await tx.book.findFirst({ where: { id, ownerId }, select: { totalPages: true } });
        if (!book) throw new BookError("Book not found.", 404);
        if ("page" in action && action.page > book.totalPages) throw new BookError("That page is outside this book.");
        const updated = await tx.book.updateMany({ where: { id, ownerId, revision: action.revision }, data: {
          revision: { increment: 1 }, ...(action.action === "page" ? { currentPage: action.page, lastRead: new Date() } : {}),
        } });
        if (!updated.count) throw new BookError("This book changed in another tab. Reopen it to load the latest progress.", 409);
        if (action.action === "addMark") {
          if (await tx.bookMark.count({ where: { bookId: id } }) >= 10000) throw new BookError("This book already has 10,000 checkmarks.");
          await tx.bookMark.create({ data: { bookId: id, page: action.page, x: action.x, y: action.y } });
        }
        if (action.action === "removeMark" && !(await tx.bookMark.deleteMany({ where: { id: action.markId, bookId: id } })).count) throw new BookError("Checkmark not found.", 404);
        return reader(await tx.book.findUniqueOrThrow({ where: { id }, select: readerSelect }));
      });
    },
  };
}
