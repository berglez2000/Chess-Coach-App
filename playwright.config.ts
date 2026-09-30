import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./tests/support/database-url";

if (!process.env.CHESS_E2E_RUN_ID) throw new Error("Use npm run test:e2e to verify the isolated database before starting Playwright.");
const databaseUrl = testDatabaseUrl(process.env);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      CHESS_E2E_MODE: "deterministic",
      CHESS_E2E_RUN_ID: process.env.CHESS_E2E_RUN_ID,
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      BETTER_AUTH_SECRET: "isolated-browser-test-secret-not-for-normal-use",
      ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "",
      STOCKFISH_PATH: "/e2e-fixture-not-an-executable",
      STOCKFISH_DEPTH: "12", STOCKFISH_MOVETIME_MS: "", STOCKFISH_TIMEOUT_MS: "30000",
    },
  },
});
