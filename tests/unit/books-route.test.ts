import { beforeEach, expect, it, vi } from "vitest";
import { GET as list, POST as upload } from "@/app/api/books/route";
import { GET as detail, PATCH as change, DELETE as remove } from "@/app/api/books/[id]/route";
import { GET as file } from "@/app/api/books/[id]/file/route";
import { GET as thumbnail } from "@/app/api/books/[id]/thumbnail/route";
import { MAX_PDF_BYTES } from "@/lib/books/contract";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireApiUser: mocks.auth }));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.db }));
beforeEach(() => { vi.clearAllMocks(); });
const context = { params: Promise.resolve({ id: "guessed-id" }) };

it("checks the session before every books endpoint touches private data or reads an upload", async () => {
  mocks.auth.mockImplementation(async () => Response.json({ error: { message: "Sign in" } }, { status: 401 }));
  for (const handler of [list, upload, detail, change, remove, file, thumbnail]) {
    const request = new Request("http://localhost/api/books", { method: "POST", body: "private body" });
    expect((await handler(request, context)).status).toBe(401);
    expect(request.bodyUsed).toBe(false);
  }
  expect(mocks.db).not.toHaveBeenCalled();
});
it("rejects invalid and oversized imports before creating database rows", async () => {
  mocks.auth.mockResolvedValue({ id: "owner" });
  for (const request of [
    new Request("http://localhost/api/books", { method: "POST", body: "anything" }),
    new Request("http://localhost/api/books?name=Sample", { method: "POST", headers: { "Content-Type": "text/html" }, body: "anything" }),
    new Request("http://localhost/api/books?name=Sample", { method: "POST", headers: { "Content-Type": "application/pdf", "Content-Length": String(MAX_PDF_BYTES + 1) }, body: "anything" }),
  ]) expect((await upload(request)).status).toBeGreaterThanOrEqual(400);
  expect(mocks.db).not.toHaveBeenCalled();
});
it("rejects malformed reader actions before accessing the database", async () => {
  mocks.auth.mockResolvedValue({ id: "owner" });
  for (const body of ["broken JSON", JSON.stringify({ action: "page", page: 1, revision: 0, ownerId: "another" })]) {
    expect((await change(new Request("http://localhost/api/books/id", { method: "PATCH", body }), context)).status).toBe(400);
  }
  expect(mocks.db).not.toHaveBeenCalled();
});
