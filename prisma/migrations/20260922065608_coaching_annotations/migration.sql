-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "coachingImprovements" TEXT[],
ADD COLUMN     "coachingModel" TEXT,
ADD COLUMN     "coachingStrengths" TEXT[],
ADD COLUMN     "coachingSummary" TEXT;

-- CreateTable
CREATE TABLE "MoveCoachingAnnotation" (
    "id" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "headline" TEXT,
    "explanation" TEXT NOT NULL,
    "lesson" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "annotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoveCoachingAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoveCoachingAnnotation_moveId_key" ON "MoveCoachingAnnotation"("moveId");

-- AddForeignKey
ALTER TABLE "MoveCoachingAnnotation" ADD CONSTRAINT "MoveCoachingAnnotation_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "GameMove"("id") ON DELETE CASCADE ON UPDATE CASCADE;
