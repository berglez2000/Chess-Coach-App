import { defineConfig } from "prisma/config";
import { testDatabaseUrl } from "./support/database-url";

// No .env loading here: this configuration cannot select the development DB.
export default defineConfig({
  schema: "../prisma/schema.prisma",
  migrations: { path: "../prisma/migrations" },
  datasource: { url: testDatabaseUrl(process.env) },
});
