import { TEST_DATABASE_URL } from "./database-url";

/** Fail closed: fixtures are never selectable by a production build/server. */
export function e2eEnabled(env: Record<string, string | undefined>, phase: string): boolean {
  if (!env.CHESS_E2E_MODE) return false;
  if (env.CHESS_E2E_MODE !== "deterministic" ||
      phase !== "phase-development-server" ||
      env.DATABASE_URL !== TEST_DATABASE_URL ||
      !/^[a-f0-9-]{36}$/.test(env.CHESS_E2E_RUN_ID ?? "")) {
    throw new Error("E2E adapters require the explicit test runner, development server, and isolated test database.");
  }
  return true;
}
