import { requireApiUser } from "@/lib/auth/session";
import { createStockfish } from "@/lib/engine/stockfish";
import { acquireAnalysis } from "@/lib/position-analysis/capacity";
import { DIFFICULTIES, readPlayRequest } from "@/lib/play/contract";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const failure = (message: string, status: number) => Response.json({ error: { message } }, { status, headers });
export async function POST(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  let input: ReturnType<typeof readPlayRequest>;
  try {
    if (!request.body) throw new Error();
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 10000) throw new Error(); chunks.push(value); } }
    finally { await reader.cancel(); reader.releaseLock(); }
    input = readPlayRequest(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch { return failure("Provide a legal position, move history, player color, and difficulty on the engine's turn.", 400); }
  if (input.board.isGameOver()) return Response.json({ move: null, fen: input.board.fen() }, { headers });
  const release = acquireAnalysis(user.id);
  if (!release) return failure("An engine search is running. Stop analysis or wait, then retry.", 429);
  try {
    const settings = DIFFICULTIES[input.difficulty];
    const result = await createStockfish({ path: process.env.STOCKFISH_PATH ?? "", depth: 30, timeoutMs: settings.milliseconds + 5000, moveTimeMs: settings.milliseconds, skillLevel: settings.skillLevel }).analyze(input.board.fen(), { signal: request.signal, history: { startFen: input.startFen, moves: input.moves } });
    return Response.json({ move: result.bestMove, fen: input.board.fen() }, { headers });
  } catch { return failure("Stockfish could not reply. Check the engine configuration and retry.", 503); }
  finally { release(); }
}
