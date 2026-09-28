import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { assertTestDatabase, createTestDb } from "../tests/support/database";
import { testDatabaseUrl } from "../tests/support/database-url";

async function main() {
  testDatabaseUrl(process.env);
  const db = createTestDb();
  const runId = randomUUID();
  try {
    await assertTestDatabase(db);
    const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "tests/prisma.config.ts"], { stdio: "inherit" });
    if (migration.status !== 0) throw new Error("Test migration failed");
    const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
      stdio: "inherit",
      env: { ...process.env, CHESS_E2E_RUN_ID: runId },
    });
    process.exitCode = result.status ?? 1;
  } finally {
    // Also clean imports whose test failed before it captured the saved URL.
    try {
      await assertTestDatabase(db);
      await db.game.deleteMany({ where: { whiteName: { startsWith: `E2E-${runId}-` } } });
    } finally { await db.$disconnect(); }
  }
}
main().catch(() => {
  console.error("Browser test setup failed. Unset DATABASE_URL and start the dedicated postgres-test service. No development cleanup is performed.");
  process.exitCode = 1;
});
