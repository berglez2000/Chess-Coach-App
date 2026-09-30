import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { assertTestDatabase, createTestDb } from "../support/database";

it("migrates legacy Anthropic coaching without changing content or model", async () => {
  const db = createTestDb();
  // All DDL and seed data live in this transaction's uniquely named schema.
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  try {
    await assertTestDatabase(db);
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      const migrations = readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort();
      const apply = async (name: string) => {
        for (const statement of readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").split(";").filter(sql => sql.trim())) await tx.$executeRawUnsafe(statement);
      };
      const target = migrations.indexOf("20260928150000_coaching_providers");
      expect(target).toBeGreaterThan(-1);
      for (const migration of migrations.slice(0, target)) await apply(migration);
      await tx.$executeRawUnsafe(`INSERT INTO "Game" (id,pgn,"initialFen",result,"userColor","updatedAt","coachingSummary","coachingModel") VALUES ('legacy','1. e4 *','fixture','*','WHITE',now(),'Existing summary','original-model')`);
      await tx.$executeRawUnsafe(`INSERT INTO "GameMove" (id,"gameId",ply,"moveNumber",color,san,uci,"fenBefore","fenAfter") VALUES ('move','legacy',1,1,'WHITE','e4','e2e4','before','after')`);
      await tx.$executeRawUnsafe(`INSERT INTO "MoveCoachingAnnotation" (id,"moveId","runId",classification,explanation,lesson,category,model) VALUES ('annotation','move','run','normal','Existing explanation','Existing lesson','other','original-model')`);
      await apply(migrations[target]);
      expect(await tx.$queryRawUnsafe(`SELECT "coachingProvider", "coachingModel", "coachingSummary", "coachingRevision" FROM "Game"`)).toEqual([{ coachingProvider: "ANTHROPIC", coachingModel: "original-model", coachingSummary: "Existing summary", coachingRevision: 0 }]);
      expect(await tx.$queryRawUnsafe(`SELECT provider, model, explanation FROM "MoveCoachingAnnotation"`)).toEqual([{ provider: "ANTHROPIC", model: "original-model", explanation: "Existing explanation" }]);
      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    });
  } finally { await db.$disconnect(); }
});
