-- CreateEnum
CREATE TYPE "ChessColor" AS ENUM ('WHITE', 'BLACK');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'ENGINE_RUNNING', 'ENGINE_COMPLETED', 'AI_RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "pgn" TEXT NOT NULL,
    "initialFen" TEXT NOT NULL,
    "whiteName" TEXT,
    "blackName" TEXT,
    "result" TEXT NOT NULL,
    "playedAt" DATE,
    "event" TEXT,
    "site" TEXT,
    "round" TEXT,
    "openingName" TEXT,
    "eco" TEXT,
    "timeControl" TEXT,
    "termination" TEXT,
    "userColor" "ChessColor" NOT NULL,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameMove" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ply" INTEGER NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "color" "ChessColor" NOT NULL,
    "san" TEXT NOT NULL,
    "uci" TEXT NOT NULL,
    "fenBefore" TEXT NOT NULL,
    "fenAfter" TEXT NOT NULL,

    CONSTRAINT "GameMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_createdAt_id_idx" ON "Game"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "GameMove_gameId_ply_key" ON "GameMove"("gameId", "ply");

-- AddForeignKey
ALTER TABLE "GameMove" ADD CONSTRAINT "GameMove_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
