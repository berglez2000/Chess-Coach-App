CREATE TYPE "CoachingProvider" AS ENUM ('ANTHROPIC', 'OPENAI');
CREATE TABLE "AppSettings" (
  "id" TEXT NOT NULL DEFAULT 'local',
  "coachingProvider" "CoachingProvider" NOT NULL DEFAULT 'ANTHROPIC',
  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppSettings_singleton" CHECK ("id" = 'local')
);
ALTER TABLE "Game"
  ADD COLUMN "coachingProvider" "CoachingProvider",
  ADD COLUMN "coachingRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coachingRunProvider" "CoachingProvider",
  ADD COLUMN "coachingRunModel" TEXT;
ALTER TABLE "MoveCoachingAnnotation" ADD COLUMN "provider" "CoachingProvider" NOT NULL DEFAULT 'ANTHROPIC';
UPDATE "Game" SET "coachingProvider" = 'ANTHROPIC' WHERE "coachingSummary" IS NOT NULL OR "coachingModel" IS NOT NULL;
