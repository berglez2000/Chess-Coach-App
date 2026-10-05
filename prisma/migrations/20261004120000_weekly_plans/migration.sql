CREATE TABLE "WeeklyPlanWorkspace" (
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "draftId" TEXT,
    "generationId" TEXT,
    "acceptedId" TEXT,
    CONSTRAINT "WeeklyPlanWorkspace_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "WeeklyPlanGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "inputs" JSONB NOT NULL,
    "provider" "CoachingProvider" NOT NULL,
    "requestedModel" TEXT NOT NULL,
    "model" TEXT,
    "definition" JSONB,
    "generatedDefinition" JSONB,
    "draftRevision" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyPlanGeneration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WeeklyPlanVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "generationId" TEXT NOT NULL,
    "draftRevision" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "provider" "CoachingProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyPlanVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeeklyPlanWorkspace_draftId_key" ON "WeeklyPlanWorkspace"("draftId");
CREATE UNIQUE INDEX "WeeklyPlanWorkspace_generationId_key" ON "WeeklyPlanWorkspace"("generationId");
CREATE UNIQUE INDEX "WeeklyPlanWorkspace_acceptedId_key" ON "WeeklyPlanWorkspace"("acceptedId");
CREATE UNIQUE INDEX "WeeklyPlanGeneration_userId_requestId_key" ON "WeeklyPlanGeneration"("userId", "requestId");
CREATE INDEX "WeeklyPlanGeneration_userId_createdAt_idx" ON "WeeklyPlanGeneration"("userId", "createdAt");
CREATE UNIQUE INDEX "WeeklyPlanVersion_userId_version_key" ON "WeeklyPlanVersion"("userId", "version");
CREATE UNIQUE INDEX "WeeklyPlanVersion_userId_generationId_draftRevision_key" ON "WeeklyPlanVersion"("userId", "generationId", "draftRevision");
ALTER TABLE "WeeklyPlanWorkspace" ADD CONSTRAINT "WeeklyPlanWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlanGeneration" ADD CONSTRAINT "WeeklyPlanGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlanVersion" ADD CONSTRAINT "WeeklyPlanVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlanWorkspace" ADD CONSTRAINT "WeeklyPlanWorkspace_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "WeeklyPlanGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlanWorkspace" ADD CONSTRAINT "WeeklyPlanWorkspace_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "WeeklyPlanGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlanWorkspace" ADD CONSTRAINT "WeeklyPlanWorkspace_acceptedId_fkey" FOREIGN KEY ("acceptedId") REFERENCES "WeeklyPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
