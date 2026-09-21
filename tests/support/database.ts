import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { testDatabaseUrl } from "./database-url";

export function createTestDb() {
  return new PrismaClient({ adapter: new PrismaPg({
    connectionString: testDatabaseUrl(process.env),
    connectionTimeoutMillis: 5_000,
  }) });
}

export async function assertTestDatabase(db: PrismaClient) {
  const [identity] = await db.$queryRaw<Array<{ database: string; user: string }>>`
    SELECT current_database() AS database, current_user AS "user"
  `;
  if (identity?.database !== "chess_coach_test" || identity?.user !== "chess_coach_test") {
    throw new Error("Refusing migration or cleanup: connected database is not the dedicated test database.");
  }
}
