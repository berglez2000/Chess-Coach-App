// Runs under tsx, separately from Playwright's CommonJS transform of Prisma ESM.
import { assertTestDatabase, createTestDb } from "./database";
const db = createTestDb();
try {
  await assertTestDatabase(db);
  const [action, id] = process.argv.slice(2);
  const game = await db.game.findUniqueOrThrow({
    where: { id },
    include: { moves: { orderBy: { ply: "asc" }, include: { engineAnalysis: true, coachingAnnotation: true } } },
  });
  if (!process.env.CHESS_E2E_RUN_ID || !game.whiteName?.startsWith(`E2E-${process.env.CHESS_E2E_RUN_ID}-`)) {
    throw new Error("Refusing access to a game outside this browser test run");
  }
  if (action === "read") console.log(JSON.stringify(game));
  else if (action === "delete") await db.game.delete({ where: { id } });
  else throw new Error("Unknown browser database operation");
} finally { await db.$disconnect(); }
