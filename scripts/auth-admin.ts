import { loadEnvConfig } from "@next/env";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { claimLegacyGames, resetLocalPassword } from "../lib/auth/admin";

loadEnvConfig(process.cwd());

async function main() {
  const [command, email, ...extra] = process.argv.slice(2);
  if (!["claim-legacy", "reset-password"].includes(command) || !email?.includes("@") || extra.length) {
    throw new Error("Usage: npm run auth:admin -- <claim-legacy|reset-password> you@example.com");
  }
  const { getDb } = await import("../lib/db/client");
  const db = getDb();
  try {
    if (command === "claim-legacy") {
      const count = await claimLegacyGames(db, email);
      console.log(`Assigned ${count} previously unowned games. Existing owned games and settings were preserved.`);
    } else {
      if (!process.stdin.isTTY) throw new Error("Run password recovery in an interactive terminal. Never pass passwords as command arguments.");
      // Suppress terminal echo; the password never enters arguments, logs or history.
      const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
      const prompt = createInterface({ input: process.stdin, output, terminal: true });
      try {
        process.stdout.write("New password (hidden): ");
        const password = await prompt.question("");
        process.stdout.write("\nConfirm password (hidden): ");
        const confirmation = await prompt.question("");
        process.stdout.write("\n");
        if (password !== confirmation) throw new Error("Passwords do not match.");
        await resetLocalPassword(db, email, password);
        console.log("Password reset. All sessions for this account were revoked. Sign in again.");
      } finally { prompt.close(); }
    }
  } finally { await db.$disconnect(); }
}

main().catch(error => {
  // Do not print database/connection exceptions or credentials.
  const known = ["Usage:", "Register the target", "Legacy analysis", "Run password", "Passwords do not", "Use a password", "No account found", "The account has no"];
  console.error(error instanceof Error && known.some(prefix => error.message.startsWith(prefix)) ? error.message : "Account maintenance failed. Check local PostgreSQL and migrations.");
  process.exitCode = 1;
});
