import { readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { booksRepository } from "@/lib/books/repository";
import { inspectPdf } from "@/lib/books/pdf";
import { assertTestDatabase, createTestDb } from "../support/database";
import { createTestOwner } from "../support/test-owner";

vi.mock("server-only", () => ({}));

const db = createTestDb();
const owners: string[] = [];
let data: Uint8Array<ArrayBuffer>;
beforeAll(async () => {
  await assertTestDatabase(db);
  owners.push(await createTestOwner(db), await createTestOwner(db));
  data = new Uint8Array(await readFile("tests/fixtures/pdf/sample.pdf"));
});
afterEach(async () => { await db.book.deleteMany({ where: { ownerId: { in: owners } } }); });
afterAll(async () => { await db.user.deleteMany({ where: { id: { in: owners } } }); await db.$disconnect(); });
const own = () => booksRepository(db, owners[0]);
const other = () => booksRepository(db, owners[1]);
async function saved() { return own().create("Original sample", data, 3, null); }

it("validates actual PDFs, generates a thumbnail and rejects corrupt PDF data", async () => {
  const inspected = await inspectPdf(data);
  expect(inspected.totalPages).toBe(3);
  expect(inspected.thumbnail?.byteLength).toBeGreaterThan(0);
  await expect(inspectPdf(new TextEncoder().encode("%PDF-1.4\ninvalid"))).rejects.toThrow("Could not read this PDF");
});
it("persists the PDF, page and positioned checkmarks, and deduplicates imports without losing progress", async () => {
  let book = await saved();
  book = await own().change(book.id, { action: "page", page: 2, revision: book.revision });
  book = await own().change(book.id, { action: "addMark", page: 2, x: 0.25, y: 0.75, revision: book.revision });
  expect(await own().file(book.id)).toEqual(data);
  expect(await own().get(book.id)).toMatchObject({ currentPage: 2, marks: [{ x: 0.25, y: 0.75, page: 2 }] });
  expect(await own().create("Reimported", data, 3, null)).toEqual(book);
  expect(await own().list()).toHaveLength(1);
  expect((await own().list())[0]).not.toHaveProperty("pdf");
  expect((await own().list())[0]).not.toHaveProperty("thumbnail");
  const removed = await own().change(book.id, { action: "removeMark", markId: book.marks[0].id, revision: book.revision });
  expect(removed.marks).toEqual([]);
});
it("isolates all reads and mutations including raw PDFs, thumbnails, and identical files", async () => {
  const book = await saved();
  expect(await other().list()).toEqual([]);
  expect(await other().get(book.id)).toBeNull();
  expect(await other().file(book.id)).toBeNull();
  expect(await other().file(book.id, true)).toBeNull();
  expect(await other().remove(book.id)).toBe(false);
  for (const action of [
    { action: "page" as const, page: 2, revision: 0 },
    { action: "addMark" as const, page: 1, x: 0.5, y: 0.5, revision: 0 },
    { action: "removeMark" as const, markId: "guessed", revision: 0 },
  ]) await expect(other().change(book.id, action)).rejects.toMatchObject({ status: 404 });
  expect((await other().create("Same file", data, 3, null)).id).not.toBe(book.id);
  expect(await own().get(book.id)).toEqual(book);
});
it("rejects stale concurrent updates and invalid pages without partial checkmarks", async () => {
  const book = await saved();
  const results = await Promise.allSettled([0.25, 0.75].map(x => own().change(book.id, { action: "addMark", page: 1, x, y: 0.5, revision: 0 })));
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await own().get(book.id)).toMatchObject({ revision: 1, marks: [expect.any(Object)] });
  await expect(own().change(book.id, { action: "page", page: 4, revision: 1 })).rejects.toMatchObject({ status: 400 });
  await expect(own().change(book.id, { action: "removeMark", markId: "missing", revision: 1 })).rejects.toMatchObject({ status: 404 });
  expect((await own().get(book.id))?.revision).toBe(1);
});
it("deletes a book and its marks without changing another book", async () => {
  const book = await saved();
  await own().change(book.id, { action: "addMark", page: 1, x: 0.5, y: 0.5, revision: 0 });
  const another = await own().create("Different file", new Uint8Array([...data, 10]), 3, null);
  expect(await own().remove(book.id)).toBe(true);
  expect(await db.bookMark.count({ where: { bookId: book.id } })).toBe(0);
  expect(await own().file(book.id)).toBeNull();
  expect(await own().get(another.id)).toEqual(another);
});
