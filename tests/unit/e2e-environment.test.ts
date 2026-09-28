import { expect, it } from "vitest";
import { e2eEnabled } from "../support/e2e-environment";
import { TEST_DATABASE_URL } from "../support/database-url";

const valid = { CHESS_E2E_MODE: "deterministic", CHESS_E2E_RUN_ID: "12345678-1234-1234-1234-123456789abc", DATABASE_URL: TEST_DATABASE_URL };
it("leaves normal development and production on real adapters", () => {
  for (const phase of ["phase-development-server", "phase-production-build", "phase-production-server"]) {
    expect(e2eEnabled({}, phase)).toBe(false);
  }
});
it("allows only an explicit isolated browser-test launch", () => {
  expect(e2eEnabled(valid, "phase-development-server")).toBe(true);
  for (const env of [{ ...valid, DATABASE_URL: "postgresql://localhost/chess_coach" }, { ...valid, CHESS_E2E_RUN_ID: "" }, { ...valid, CHESS_E2E_MODE: "true" }]) {
    expect(() => e2eEnabled(env, "phase-development-server")).toThrow("E2E adapters require");
  }
  for (const phase of ["phase-production-build", "phase-production-server"]) {
    expect(() => e2eEnabled(valid, phase)).toThrow("E2E adapters require");
  }
});
