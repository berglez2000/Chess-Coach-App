import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { expect, it } from "vitest";
import { claimLegacyGames } from "@/lib/auth/admin";
import { createAuth } from "@/lib/auth/create-auth";
import { assertTestDatabase, createTestDb } from "../support/database";
import { testDatabaseUrl } from "../support/database-url";

it("preserves legacy data, leaves it unclaimed at signup, and assigns it explicitly once", async () => {
  const admin = createTestDb();
  const schema = `auth_migration_${randomUUID().replaceAll("-", "")}`;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl(process.env) }, { schema }) });
  try {
    await assertTestDatabase(admin);
    await admin.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      const migrations = readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort();
      const apply = async (name: string) => {
        for (const sql of readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").split(";").filter(sql => sql.trim())) await tx.$executeRawUnsafe(sql);
      };
      const index = migrations.indexOf("20260930120000_auth_and_ownership");
      expect(index).toBeGreaterThan(-1);
      for (const migration of migrations.slice(0, index)) await apply(migration);
      await tx.$executeRawUnsafe(`INSERT INTO "Game" (id,pgn,"initialFen",result,"userColor","updatedAt","coachingSummary","coachingModel","coachingProvider") VALUES ('legacy','1. e4 *','fixture','*','WHITE',now(),'Existing summary','original-model','OPENAI')`);
      await tx.$executeRawUnsafe(`INSERT INTO "GameMove" (id,"gameId",ply,"moveNumber",color,san,uci,"fenBefore","fenAfter") VALUES ('move','legacy',1,1,'WHITE','e4','e2e4','before','after')`);
      await tx.$executeRawUnsafe(`INSERT INTO "AppSettings" (id,"coachingProvider") VALUES ('local','OPENAI')`);
      await apply(migrations[index]);
    });
    const auth = createAuth(db, { BETTER_AUTH_URL: "http://localhost:3098", BETTER_AUTH_SECRET: "isolated-auth-migration-test-secret-only" });
    const { user } = await auth.api.signUpEmail({ body: { name: "Explicit owner", email: "owner@example.test", password: "migration test passphrase" } });
    expect((await db.game.findUniqueOrThrow({ where: { id: "legacy" } })).ownerId).toBeNull();
    await db.game.update({ where: { id: "legacy" }, data: { analysisStatus: "ENGINE_RUNNING" } });
    await expect(claimLegacyGames(db, user.email)).rejects.toThrow("Legacy analysis is unfinished");
    await db.game.update({ where: { id: "legacy" }, data: { analysisStatus: "COMPLETED" } });
    expect(await claimLegacyGames(db, user.email)).toBe(1);
    expect(await claimLegacyGames(db, user.email)).toBe(0);
    const stored = await db.game.findUniqueOrThrow({ where: { id: "legacy" }, include: { moves: true } });
    expect(stored).toMatchObject({ ownerId: user.id, pgn: "1. e4 *", coachingSummary: "Existing summary", coachingModel: "original-model", coachingProvider: "OPENAI" });
    expect(stored.moves).toHaveLength(1);
    expect((await db.userSettings.findUniqueOrThrow({ where: { userId: user.id } })).coachingProvider).toBe("OPENAI");
    await db.userSettings.update({ where: { userId: user.id }, data: { coachingProvider: "ANTHROPIC" } });
    await claimLegacyGames(db, user.email);
    expect((await db.userSettings.findUniqueOrThrow({ where: { userId: user.id } })).coachingProvider).toBe("ANTHROPIC");
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});
