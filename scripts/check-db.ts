import { loadEnvConfig } from "@next/env";
import { readDatabaseUrl } from "../lib/db/config";

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  try {
    readDatabaseUrl(process.env);
  } catch {
    console.error(
      "Database check failed: set a valid PostgreSQL DATABASE_URL in .env.local. See README.md.",
    );
    process.exitCode = 1;
    return;
  }

  const { getDb } = await import("../lib/db/client");
  const db = getDb();
  try {
    const rows = await db.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;
    if (rows.length !== 1 || rows[0].result !== 1) {
      throw new Error("Unexpected database response");
    }
    console.log("Database connection OK (SELECT 1).");
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Database check failed: confirm PostgreSQL is healthy and DATABASE_URL matches its host, port, database, and credentials. See README.md.",
  );
  process.exitCode = 1;
});
