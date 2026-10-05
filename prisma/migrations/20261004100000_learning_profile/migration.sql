CREATE TABLE "LearningProfileRevision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "resourceTitles" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningProfileRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LearningProfileRevision_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "LearningProfileRevision_userId_revision_key" ON "LearningProfileRevision"("userId", "revision");
ALTER TABLE "LearningProfileRevision" ADD CONSTRAINT "LearningProfileRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
