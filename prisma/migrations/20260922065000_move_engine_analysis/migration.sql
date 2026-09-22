-- CreateTable
CREATE TABLE "MoveEngineAnalysis" (
    "id" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "beforeCp" INTEGER,
    "beforeMate" INTEGER,
    "afterCp" INTEGER,
    "afterMate" INTEGER,
    "bestMoveUci" TEXT,
    "bestMoveSan" TEXT,
    "pvUci" TEXT[],
    "pvSan" TEXT[],
    "cpLoss" INTEGER,
    "classification" TEXT NOT NULL,
    "assessment" JSONB NOT NULL,
    "configuration" JSONB NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoveEngineAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoveEngineAnalysis_moveId_key" ON "MoveEngineAnalysis"("moveId");

-- AddForeignKey
ALTER TABLE "MoveEngineAnalysis" ADD CONSTRAINT "MoveEngineAnalysis_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "GameMove"("id") ON DELETE CASCADE ON UPDATE CASCADE;

