import { describe, expect, it } from "vitest";
import { readDatabaseUrl } from "@/lib/db/config";

describe("database configuration", () => {
  it.each(["postgresql", "postgres"])("accepts the %s protocol", (protocol) => {
    const url = `${protocol}://user:password@127.0.0.1:5433/chess_coach`;
    expect(readDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it.each([
    undefined,
    "",
    "  ",
    "not-a-url",
    "https://user:secret@localhost/database",
    "postgresql://localhost",
    "postgresql:///database",
  ])("rejects invalid configuration without exposing its value (%#)", (value) => {
    expect(() => readDatabaseUrl({ DATABASE_URL: value })).toThrow(
      "DATABASE_URL must be a PostgreSQL URL with a host and database name. Set it in .env.local; see README.md.",
    );
  });

  it("does not include credentials in validation errors", () => {
    try {
      readDatabaseUrl({ DATABASE_URL: "https://user:private-password@localhost/db" });
      expect.fail("Invalid protocol must fail");
    } catch (error) {
      expect(String(error)).not.toContain("private-password");
      expect(String(error)).not.toContain("https://");
    }
  });
});
