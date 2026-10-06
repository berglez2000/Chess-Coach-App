import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { readDatabaseUrl } from "./config";

const databaseGlobal = globalThis as unknown as {
  chessCoachDb?: PrismaClient;
  chessCoachDbModels?: string;
};

export function getDb(): PrismaClient {
  // HMR preserves globals even when a regenerated client adds/removes model delegates.
  const models = Object.keys(Prisma.ModelName).sort().join("|");
  if (!databaseGlobal.chessCoachDb || databaseGlobal.chessCoachDbModels !== models) {
    const previous = databaseGlobal.chessCoachDb;
    const adapter = new PrismaPg({
      connectionString: readDatabaseUrl(process.env),
      connectionTimeoutMillis: 5_000,
      max: 5,
    });
    databaseGlobal.chessCoachDb = new PrismaClient({ adapter });
    databaseGlobal.chessCoachDbModels = models;
    // Retire the old pool without blocking the request that repairs the cache.
    if (previous) void previous.$disconnect().catch(() => {});
  }
  return databaseGlobal.chessCoachDb;
}
