import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
import { readDatabaseUrl } from "./lib/db/config";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generation and validation work without credentials or a running database.
  datasource: process.env.DATABASE_URL
    ? { url: readDatabaseUrl(process.env) }
    : undefined,
});
