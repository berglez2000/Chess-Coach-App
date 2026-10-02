import { expect, it, vi } from "vitest";
import { readPdfUpload, BookError } from "@/lib/books/pdf";
import { MAX_PDF_BYTES, bookActionSchema } from "@/lib/books/contract";
import { bookFailure } from "@/lib/books/http";

it("bounds PDF bodies using both declared length and actual streamed bytes", async () => {
  await expect(readPdfUpload(new Request("http://localhost", { method: "POST", body: "x", headers: { "Content-Length": String(MAX_PDF_BYTES + 1) } }))).rejects.toMatchObject({ status: 413 });
  const cancel = vi.fn();
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_PDF_BYTES + 1)); }, cancel });
  await expect(readPdfUpload(new Request("http://localhost", { method: "POST", body, duplex: "half" } as RequestInit))).rejects.toMatchObject({ status: 413 });
  expect(cancel).toHaveBeenCalled();
  await expect(readPdfUpload(new Request("http://localhost", { method: "POST", body: "not a pdf" }))).rejects.toThrow("not a valid PDF");
});
it("validates bounded coordinates, integer pages and revisions, and rejects ownership injection", () => {
  const mark = { action: "addMark", revision: 0, page: 1, x: 0.5, y: 0.5 };
  expect(bookActionSchema.safeParse(mark).success).toBe(true);
  for (const change of [{ x: 1.01 }, { y: -1 }, { page: 0 }, { page: 1.5 }, { revision: -1 }, { ownerId: "other" }, { x: NaN }]) expect(bookActionSchema.safeParse({ ...mark, ...change }).success).toBe(false);
});
it("sanitizes database errors and forbids caching private reader responses", async () => {
  const response = bookFailure(new Error("private database connection"));
  expect(response.status).toBe(500);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(JSON.stringify(await response.json())).not.toContain("private database");
  expect(bookFailure(new BookError("Book not found.", 404)).status).toBe(404);
});
