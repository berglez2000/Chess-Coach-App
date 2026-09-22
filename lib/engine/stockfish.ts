import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Chess } from "chess.js";
import type { ChessEngine, EngineInfo, EngineResult } from "@/types/engine";
import { validateEngineConfig, type EngineConfig } from "./config";
import { EngineError } from "./error";
import { parseBestMove, parseInfo } from "./protocol";

type StartProcess = (path: string) => ChildProcessWithoutNullStreams;
const startProcess: StartProcess = path => spawn(path, [], { shell: false, stdio: "pipe" });

/** One isolated process per position. No process state is shared between callers. */
export function createStockfish(config: EngineConfig, start: StartProcess = startProcess): ChessEngine {
  const settings = validateEngineConfig(config);
  return {
    async analyze(fen) {
      let board: Chess;
      try {
        if (/[\r\n\0]/.test(fen) || fen.trim().split(/\s+/).length !== 6) throw new Error();
        board = new Chess(fen);
      } catch { throw new EngineError("INVALID_FEN", "Provide a valid standard-chess FEN."); }
      let child: ChildProcessWithoutNullStreams;
      try { child = start(settings.path); }
      catch { throw new EngineError("UNAVAILABLE", "Could not start Stockfish. Check its executable path and permissions."); }
      return new Promise<EngineResult>((resolve, reject) => {
        let phase: "uci" | "ready" | "search" | "closing" = "uci";
        let buffer = "";
        let evaluation: EngineInfo | null = null;
        let result: EngineResult | undefined;
        let failure: EngineError | undefined;
        let closed = false;
        let killTimer: ReturnType<typeof setTimeout> | undefined;
        let closeTimer: ReturnType<typeof setTimeout> | undefined;
        let deadline: ReturnType<typeof setTimeout>;
        const cleanup = () => {
          clearTimeout(deadline); clearTimeout(killTimer); clearTimeout(closeTimer);
          child.stdout.off("data", data);
          child.off("error", processError); child.off("close", close);
          child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
          child.stdin.off("error", processError);
          child.stdout.off("error", processError); child.stderr.off("error", processError);
        };
        const settle = () => {
          cleanup();
          if (failure) reject(failure);
          else if (result) resolve(result);
          else reject(new EngineError("EXITED", "Stockfish exited before completing analysis."));
        };
        const send = (command: string) => {
          try { child.stdin.write(`${command}\n`); }
          catch { processError(); }
        };
        const finish = (error?: EngineError) => {
          if (phase === "closing") return;
          phase = "closing"; failure = error;
          clearTimeout(deadline);
          // Keep listeners until close, including asynchronous pipe errors.
          killTimer = setTimeout(() => { if (!closed) child.kill("SIGKILL"); }, 250);
          closeTimer = setTimeout(() => {
            failure ??= new EngineError("EXITED", "Stockfish did not shut down cleanly.");
            child.unref(); settle();
          }, 1500);
          send("stop"); send("quit");
        };
        const processError = () => finish(new EngineError("UNAVAILABLE", "Stockfish could not run. Check its executable path and permissions."));
        const close = () => {
          closed = true;
          if (phase !== "closing") failure = new EngineError("EXITED", "Stockfish exited before completing analysis.");
          settle();
        };
        const line = (text: string) => {
          if (phase === "uci" && text === "uciok") {
            phase = "ready";
            send("setoption name Threads value 1"); send("setoption name Hash value 16");
            send("setoption name MultiPV value 1"); send("ucinewgame"); send("isready");
          } else if (phase === "ready" && text === "readyok") {
            phase = "search";
            clearTimeout(deadline);
            deadline = setTimeout(() => finish(new EngineError("TIMEOUT", "Stockfish analysis timed out. Try a lower search limit.")), settings.timeoutMs);
            send(`position fen ${fen}`);
            send(settings.moveTimeMs === undefined ? `go depth ${settings.depth}` : `go movetime ${settings.moveTimeMs}`);
          } else if (phase === "search") {
            if (text.startsWith("bestmove")) {
              const bestMove = parseBestMove(text);
              const legal = board.moves({ verbose: true }).map(move => move.from + move.to + (move.promotion ?? ""));
              if ((bestMove === null && legal.length > 0) || (bestMove !== null && !legal.includes(bestMove))) throw new EngineError("PROTOCOL", "Stockfish returned a best move inconsistent with the position.");
              result = { perspective: board.turn() === "w" ? "WHITE" : "BLACK", bestMove, evaluation };
              finish();
            } else {
              const info = parseInfo(text);
              if (info) {
                const variation = new Chess(fen);
                try { for (const move of info.pv) variation.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }); }
                catch { throw new EngineError("PROTOCOL", "Stockfish returned an illegal principal variation."); }
                evaluation = info;
              }
            }
          }
        };
        const data = (chunk: Buffer | string) => {
          if (phase === "closing") return;
          buffer += chunk.toString();
          if (buffer.length > 1_000_000) { finish(new EngineError("PROTOCOL", "Stockfish output exceeded the protocol limit.")); return; }
          const lines = buffer.split("\n"); buffer = lines.pop()!;
          try { for (const text of lines) line(text.trim()); }
          catch (error) { finish(error instanceof EngineError ? error : new EngineError("PROTOCOL", "Stockfish returned malformed output.")); }
        };
        child.on("error", processError); child.once("close", close);
        child.stdin.on("error", processError); child.stdout.on("data", data);
        child.stdout.on("error", processError); child.stderr.on("error", processError);
        child.stderr.resume();
        deadline = setTimeout(() => finish(new EngineError("TIMEOUT", "Stockfish initialization timed out.")), 5000);
        send("uci");
      });
    },
  };
}
