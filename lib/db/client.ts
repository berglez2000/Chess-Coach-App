import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readDatabaseUrl } from "./config";

const databaseGlobal = globalThis as unknown as {
  chessCoachDb?: PrismaClient;
};

export function getDb(): PrismaClient {
  if (!databaseGlobal.chessCoachDb) {
    const adapter = new PrismaPg({
      connectionString: readDatabaseUrl(process.env),
      connectionTimeoutMillis: 5_000,
      max: 5,
    });
    databaseGlobal.chessCoachDb = new PrismaClient({ adapter });
  }
  return databaseGlobal.chessCoachDb;
}
