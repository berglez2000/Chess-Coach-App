import { requireApiUser } from "@/lib/auth/session";
import { createStockfish } from "@/lib/engine/stockfish";
import { EngineError } from "@/lib/engine/error";
import { acquireAnalysis } from "@/lib/position-analysis/capacity";
import { positionResult, readAnalysisRequest, SEARCH_PRESETS, terminalResult, type AnalysisEvent } from "@/lib/position-analysis/contract";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const failure = (message: string, status: number) => Response.json({ error: { message } }, { status, headers });
async function readBody(request: Request) {
  if (!request.body) throw new Error();
  const reader = request.body.getReader(); let bytes = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 10000) throw new Error(); chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel(); reader.releaseLock(); }
}
export async function POST(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  let input: ReturnType<typeof readAnalysisRequest>;
  try { input = readAnalysisRequest(await readBody(request)); }
  catch { return failure("Provide a legal starting FEN, up to 400 legal moves, and a supported search preset.", 400); }
  const terminal = terminalResult(input.board);
  if (terminal) return new Response(JSON.stringify({ type: "complete", result: terminal }) + "\n", { headers: { ...headers, "Content-Type": "application/x-ndjson" } });
  const release = acquireAnalysis(user.id);
  if (!release) return failure("An analysis search is already running. Stop it or wait a moment, then try again.", 429);
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      const encoder = new TextEncoder(); let lastUpdate = 0;
      const emit = (event: AnalysisEvent) => { if (!controller.signal.aborted) output.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
      try {
        const engine = createStockfish({ path: process.env.STOCKFISH_PATH ?? "", depth: 30,
          moveTimeMs: SEARCH_PRESETS[input.preset].milliseconds, timeoutMs: SEARCH_PRESETS[input.preset].milliseconds + 5000, multiPv: 3 });
        const result = await engine.analyze(input.board.fen(), { signal: controller.signal, history: { startFen: input.startFen, moves: input.moves }, onProgress(result) {
          if (!result.variations?.length || Date.now() - lastUpdate < 100) return;
          lastUpdate = Date.now(); emit({ type: "progress", result: positionResult(input.board.fen(), result) });
        } });
        emit({ type: "complete", result: positionResult(input.board.fen(), result) });
      } catch (error) {
        if (!controller.signal.aborted) emit({ type: "error", message: error instanceof EngineError && error.code === "TIMEOUT"
          ? "Stockfish timed out. Try a shorter search or retry."
          : "Stockfish analysis is unavailable. Check the engine configuration and retry." });
      } finally {
        request.signal.removeEventListener("abort", abort); release();
        try { output.close(); } catch { /* Reader cancellation already closed the stream. */ }
      }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { ...headers, "Content-Type": "application/x-ndjson", "X-Accel-Buffering": "no" } });
}
