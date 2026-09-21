import { spawnSync } from "node:child_process";
import { createTestDb, assertTestDatabase } from "../tests/support/database";

async function main() {
  const db = createTestDb();
  try {
    await assertTestDatabase(db);
  } finally {
    await db.$disconnect();
  }
  for (const args of [
    ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "tests/prisma.config.ts"],
    ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.mts", ...process.argv.slice(2)],
  ]) {
    const result = spawnSync(process.execPath, args, {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "test" },
    });
    if (result.error || result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

main().catch(() => {
  console.error("Integration setup refused or could not connect. Unset DATABASE_URL, use the documented TEST_DATABASE_URL, and start the postgres-test Compose service. No development cleanup is performed.");
  process.exitCode = 1;
});
