-- Tie action history to its source challenge so deleting a game removes move logs too.
ALTER TABLE "ReplayAction" ADD COLUMN "challengeId" TEXT;
ALTER TABLE "ReplayAction" ADD CONSTRAINT "ReplayAction_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "ReplayChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ReplayAction_challengeId_idx" ON "ReplayAction"("challengeId");
