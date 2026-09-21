import { describe, expect, it, vi } from "vitest";
import { testDatabaseUrl, TEST_DATABASE_URL } from "../support/database-url";
import { assertTestDatabase } from "../support/database";

describe("integration database safety", () => {
  it("uses only the dedicated test service", () => {
    expect(testDatabaseUrl({})).toBe(TEST_DATABASE_URL);
    expect(testDatabaseUrl({ TEST_DATABASE_URL })).toBe(TEST_DATABASE_URL);
  });
  it.each([
    "postgresql://chess_coach:password@127.0.0.1:5433/chess_coach",
    TEST_DATABASE_URL.replace("127.0.0.1", "example.com"),
    TEST_DATABASE_URL + "?schema=public",
    TEST_DATABASE_URL.replace("5434", "5433"),
    "",
  ])("refuses a substituted target (%#)", (url) => {
    expect(() => testDatabaseUrl({ TEST_DATABASE_URL: url })).toThrow("Refusing another database target");
  });
  it("refuses an inherited development DATABASE_URL", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: "postgresql://localhost/chess_coach" })).toThrow("Unset DATABASE_URL");
  });
  it.each([
    { database: "chess_coach", user: "chess_coach_test" },
    { database: "chess_coach_test", user: "chess_coach" },
  ])("refuses the wrong connected database identity (%#)", async (identity) => {
    const db = { $queryRaw: vi.fn().mockResolvedValue([identity]) } as unknown as Parameters<typeof assertTestDatabase>[0];
    await expect(assertTestDatabase(db)).rejects.toThrow("Refusing migration or cleanup");
  });
});
