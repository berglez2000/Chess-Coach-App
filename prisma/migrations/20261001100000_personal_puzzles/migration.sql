CREATE TABLE "PuzzleGeneration" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "token" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "configuration" JSONB NOT NULL,
    "checkedCandidates" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PuzzleGeneration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PersonalPuzzle" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "sourcePly" INTEGER NOT NULL,
    "sourceRunId" TEXT NOT NULL,
    "startingFen" TEXT NOT NULL,
    "playerColor" "ChessColor" NOT NULL,
    "acceptedMoves" TEXT[],
    "validation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalPuzzle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PuzzleGeneration_gameId_version_key" ON "PuzzleGeneration"("gameId", "version");
CREATE UNIQUE INDEX "PersonalPuzzle_generationId_sourcePly_key" ON "PersonalPuzzle"("generationId", "sourcePly");
ALTER TABLE "PuzzleGeneration" ADD CONSTRAINT "PuzzleGeneration_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalPuzzle" ADD CONSTRAINT "PersonalPuzzle_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "PuzzleGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
