-- CreateTable
CREATE TABLE "LearningMaterial" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "edition" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningChapter" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LearningChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningExercise" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validation" JSONB,
    "publishedId" TEXT,

    CONSTRAINT "LearningExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningRevision" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningProgress" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'SOLVING',
    "assisted" BOOLEAN NOT NULL DEFAULT false,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "solvedMove" TEXT,
    "playedMoves" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastOutcome" TEXT,
    "moveAttempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completionAssisted" BOOLEAN,

    CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningAttempt" (
    "id" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "expectedRevision" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "move" TEXT,
    "outcome" TEXT NOT NULL,
    "assisted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningMaterial_ownerId_archived_idx" ON "LearningMaterial"("ownerId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "LearningExercise_publishedId_key" ON "LearningExercise"("publishedId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningExercise_chapterId_number_key" ON "LearningExercise"("chapterId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LearningRevision_exerciseId_version_key" ON "LearningRevision"("exerciseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProgress_revisionId_userId_key" ON "LearningProgress"("revisionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAttempt_progressId_requestId_key" ON "LearningAttempt"("progressId", "requestId");

-- AddForeignKey
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningChapter" ADD CONSTRAINT "LearningChapter_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "LearningMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningExercise" ADD CONSTRAINT "LearningExercise_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "LearningChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningExercise" ADD CONSTRAINT "LearningExercise_publishedId_fkey" FOREIGN KEY ("publishedId") REFERENCES "LearningRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRevision" ADD CONSTRAINT "LearningRevision_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "LearningExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "LearningRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAttempt" ADD CONSTRAINT "LearningAttempt_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "LearningProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
