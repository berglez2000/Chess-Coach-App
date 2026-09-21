import { z } from "zod";

const databaseUrlSchema = z.string().trim().min(1).refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["postgresql:", "postgres:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
});

export function readDatabaseUrl(environment: Record<string, string | undefined>): string {
  const result = databaseUrlSchema.safeParse(environment.DATABASE_URL);
  if (!result.success) {
    // Never include the input or Zod details: a URL may contain credentials.
    throw new Error(
      "DATABASE_URL must be a PostgreSQL URL with a host and database name. Set it in .env.local; see README.md.",
    );
  }
  return result.data;
}
