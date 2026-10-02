-- Null solutions preserve immutable policy-v1 one-move definitions.
ALTER TABLE "PersonalPuzzle" ADD COLUMN "solution" JSONB;
ALTER TABLE "PuzzleProgress" ADD COLUMN "playedMoves" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
