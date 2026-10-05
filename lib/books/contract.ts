import { z } from "zod";

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const PDF_WORKER_URL = "/pdfjs/pdf.worker-6.3.289.mjs";
export const PDF_BROWSER_RESOURCES = {
  wasmUrl: "/pdfjs/6.3.289/wasm/",
  cMapUrl: "/pdfjs/6.3.289/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/6.3.289/standard_fonts/",
};
export const bookActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("page"), revision: z.number().int().nonnegative(), page: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("addMark"), revision: z.number().int().nonnegative(), page: z.number().int().positive(), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(),
  z.object({ action: z.literal("removeMark"), revision: z.number().int().nonnegative(), markId: z.string().min(1).max(100) }).strict(),
]);
export type BookAction = z.infer<typeof bookActionSchema>;
export type BookSummary = {
  id: string; name: string; totalPages: number; currentPage: number; revision: number;
  createdAt: string; lastRead: string | null; hasThumbnail: boolean; markCount: number;
};
export type ReaderBook = BookSummary & { marks: { id: string; page: number; x: number; y: number }[] };
