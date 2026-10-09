-- CreateTable
CREATE TABLE "ReplaySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "scopeGameId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayChallenge" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "comparison" JSONB NOT NULL,
    "progress" JSONB NOT NULL,
    "firstMove" TEXT,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "skipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReplayChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayAction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReplaySession_userId_completedAt_createdAt_idx" ON "ReplaySession"("userId", "completedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReplaySession_userId_requestId_key" ON "ReplaySession"("userId", "requestId");

-- CreateIndex
CREATE INDEX "ReplayChallenge_gameId_idx" ON "ReplayChallenge"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplayChallenge_sessionId_order_key" ON "ReplayChallenge"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ReplayAction_sessionId_requestId_key" ON "ReplayAction"("sessionId", "requestId");

-- AddForeignKey
ALTER TABLE "ReplaySession" ADD CONSTRAINT "ReplaySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayChallenge" ADD CONSTRAINT "ReplayChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayChallenge" ADD CONSTRAINT "ReplayChallenge_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayAction" ADD CONSTRAINT "ReplayAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

