CREATE TABLE "Opening" (
 "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "description" TEXT NOT NULL, "color" "ChessColor" NOT NULL, "startFen" TEXT NOT NULL,
 "lines" JSONB NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Opening_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Opening_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Opening_ownerId_updatedAt_idx" ON "Opening"("ownerId", "updatedAt");
CREATE TABLE "OpeningVideo" (
 "id" TEXT NOT NULL, "openingId" TEXT NOT NULL, "name" TEXT NOT NULL, "size" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "OpeningVideo_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "OpeningVideo_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "Opening"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OpeningVideo_openingId_createdAt_idx" ON "OpeningVideo"("openingId", "createdAt");
