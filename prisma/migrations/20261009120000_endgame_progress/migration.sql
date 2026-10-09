CREATE TABLE "EndgameProgress" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "positionId" TEXT NOT NULL, "version" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 0, "snapshot" JSONB, "attempts" INTEGER NOT NULL DEFAULT 0,
 "completedAt" TIMESTAMP(3), "completionAssisted" BOOLEAN,
 CONSTRAINT "EndgameProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EndgameProgress_userId_positionId_version_key" ON "EndgameProgress"("userId", "positionId", "version");
CREATE TABLE "EndgameAction" (
 "id" TEXT NOT NULL PRIMARY KEY, "progressId" TEXT NOT NULL, "requestId" TEXT NOT NULL,
 "expectedRevision" INTEGER NOT NULL, "snapshot" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EndgameAction_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "EndgameProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EndgameAction_progressId_requestId_key" ON "EndgameAction"("progressId", "requestId");
