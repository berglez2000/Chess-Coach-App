CREATE TABLE "Book" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "pdf" BYTEA NOT NULL,
  "thumbnail" BYTEA,
  "totalPages" INTEGER NOT NULL CHECK ("totalPages" > 0),
  "currentPage" INTEGER NOT NULL DEFAULT 1 CHECK ("currentPage" > 0 AND "currentPage" <= "totalPages"),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "lastRead" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Book_ownerId_digest_key" ON "Book"("ownerId", "digest");
CREATE INDEX "Book_ownerId_createdAt_id_idx" ON "Book"("ownerId", "createdAt", "id");
CREATE TABLE "BookMark" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookId" TEXT NOT NULL REFERENCES "Book"("id") ON DELETE CASCADE,
  "page" INTEGER NOT NULL CHECK ("page" > 0),
  "x" DOUBLE PRECISION NOT NULL CHECK ("x" >= 0 AND "x" <= 1),
  "y" DOUBLE PRECISION NOT NULL CHECK ("y" >= 0 AND "y" <= 1)
);
CREATE INDEX "BookMark_bookId_page_idx" ON "BookMark"("bookId", "page");
