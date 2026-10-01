CREATE TABLE "PuzzleProgress" (
  "id" TEXT NOT NULL,
  "puzzleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "state" TEXT NOT NULL DEFAULT 'SOLVING',
  "assisted" BOOLEAN NOT NULL DEFAULT false,
  "hintUsed" BOOLEAN NOT NULL DEFAULT false,
  "solvedMove" TEXT,
  "lastOutcome" TEXT,
  "moveAttempts" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "completionAssisted" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PuzzleProgress_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PuzzleAttempt" (
  "id" TEXT NOT NULL,
  "progressId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "expectedRevision" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "move" TEXT,
  "outcome" TEXT NOT NULL,
  "assisted" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PuzzleAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PuzzleProgress_puzzleId_userId_key" ON "PuzzleProgress"("puzzleId", "userId");
CREATE INDEX "PuzzleProgress_userId_completedAt_idx" ON "PuzzleProgress"("userId", "completedAt");
CREATE UNIQUE INDEX "PuzzleAttempt_progressId_requestId_key" ON "PuzzleAttempt"("progressId", "requestId");
ALTER TABLE "PuzzleProgress" ADD CONSTRAINT "PuzzleProgress_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "PersonalPuzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PuzzleProgress" ADD CONSTRAINT "PuzzleProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "PuzzleProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
