CREATE TABLE "UserApiKey" (
 "userId" TEXT NOT NULL, "provider" "CoachingProvider" NOT NULL, "ciphertext" TEXT NOT NULL, "lastFour" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "UserApiKey_pkey" PRIMARY KEY ("userId", "provider"),
 CONSTRAINT "UserApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
