import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { readAuthConfig } from "./config";

export function createAuth(db: PrismaClient, env: Record<string, string | undefined>) {
  const config = readAuthConfig(env);
  return betterAuth({
    ...config,
    appName: "Chess Coach",
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    trustedOrigins: [config.baseURL],
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    // Email verification/delivery are not configured for this personal-use release.
    // Never link a later OAuth identity solely because its email matches.
    account: { accountLinking: { enabled: false } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
    },
  });
}
