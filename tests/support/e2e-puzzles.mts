import { assertTestDatabase, createTestDb } from "./database";
import { createImportRepository } from "../../lib/games/import-repository";
import { parsePgn } from "../../lib/pgn/parse";

const db = createTestDb();
try {
  await assertTestDatabase(db);
  const [email, color] = process.argv.slice(2);
  if (!process.env.CHESS_E2E_RUN_ID || !email?.startsWith(`e2e-${process.env.CHESS_E2E_RUN_ID}-`) || !["WHITE", "BLACK"].includes(color)) throw new Error("Refusing puzzle fixture outside this browser run.");
  const owner = await db.user.findUniqueOrThrow({ where: { email } });
  const white = color === "WHITE";
  const parsed = parsePgn(`[White "E2E-${process.env.CHESS_E2E_RUN_ID}-puzzles"]\n\n${white ? "1. Nf3 e5 2. d4 *" : "1. e4 a6 2. d4 h6 *"}`);
  const game = await createImportRepository(db, owner.id).create(parsed, white ? "WHITE" : "BLACK");
  const generation = await db.puzzleGeneration.create({ data: { gameId: game.id, version: 1, status: "COMPLETED", configuration: { fixture: true },
    puzzles: { create: (white ? [1, 3] : [2, 4]).map((ply, index) => ({
      sourcePly: ply, sourceRunId: "browser-fixture", startingFen: parsed.moves[ply - 1].fenBefore, playerColor: white ? "WHITE" : "BLACK",
      acceptedMoves: white ? (index ? ["f3e5"] : ["e2e4", "d2d4"]) : (index ? ["g8f6"] : ["e7e5", "c7c5"]), validation: { fixture: true },
    })) },
  }, include: { puzzles: { orderBy: { sourcePly: "asc" } } } });
  console.log(JSON.stringify({ gameId: game.id, ids: generation.puzzles.map(puzzle => puzzle.id) }));
} finally { await db.$disconnect(); }
