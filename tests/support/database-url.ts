export const TEST_DATABASE_URL =
  "postgresql://chess_coach_test:chess_coach_test_local@127.0.0.1:5434/chess_coach_test";

/** Deliberately fixed target: no development URL, schema override, or remote host. */
export function testDatabaseUrl(environment: Record<string, string | undefined>): string {
  const candidate = environment.TEST_DATABASE_URL ?? TEST_DATABASE_URL;
  if (candidate !== TEST_DATABASE_URL) {
    throw new Error("Integration tests require the dedicated local postgres-test service on port 5434. Refusing another database target.");
  }
  if (environment.DATABASE_URL) {
    throw new Error("Unset DATABASE_URL before integration tests. Development database settings must not be used by the test runner.");
  }
  return candidate;
}
