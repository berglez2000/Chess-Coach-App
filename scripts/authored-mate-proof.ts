import { Chess } from "chess.js";
import { answerIdentity, contentSchema, LearningError, sanLines, type Validation } from "../lib/learning/content";
import { playUci, readSolution } from "../lib/puzzles/sequence";
import type { PuzzleSolution } from "../types/puzzle";

/** Offline exhaustive proof of authored opening moves, with all defensive replies included. */
export function proveAuthoredMate(raw: unknown, bookLines: string[] = [], limits = { nodes: 2000000, milliseconds: 300000 }): Validation {
  const content = contentSchema.parse(raw);
  if (content.type !== "MOVE" || content.objective !== "MATE") throw new LearningError("This offline verifier requires a move-based mating puzzle.");
  const practice = sanLines(content);
  const source = bookLines.flatMap(solutionText => sanLines({ ...content, solutionText }));
  const authored = [...practice, ...source];
  const roots = [...new Set(authored.map(line => line.moves[0]))];
  readSolution({ version: 2, maxPlayerMoves: 4, lines: practice }, content.fen, [...new Set(practice.map(line => line.moves[0]))], content.solver);
  const board = new Chess(content.fen);
  const solver = board.turn();
  const maxPlies = content.mateIn * 2 - 1;
  const deadline = Date.now() + limits.milliseconds;
  let nodes = 0;
  const memo = new Map<string, boolean>();
  const hints = new Map<string, string[]>();
  const replies = new Map<string, string>();
  for (const line of authored) {
    for (let i = 0; i < line.moves.length; i++) {
      if (i % 2 === 0) {
        const key = board.fen();
        hints.set(key, [...new Set([...(hints.get(key) ?? []), line.moves[i]])]);
      }
      playUci(board, line.moves[i]);
    }
    for (let i = 0; i < line.moves.length; i++) board.undo();
  }
  for (const line of practice) for (let i = 1; i < line.moves.length; i += 2) replies.set(line.moves.slice(0, i).join(" "), line.moves[i]);
  function budget() {
    if (++nodes > limits.nodes || Date.now() > deadline) throw new LearningError("Offline mate verification reached its search limit.");
  }
  function forced(plies: number): boolean {
    budget();
    if (plies <= 0) return board.turn() !== solver && board.isCheckmate();
    const key = `${board.fen()}|${plies}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const legal = board.moves({ verbose: true });
    if (!legal.length) return board.turn() !== solver && board.isCheck();
    if (board.isDrawByFiftyMoves() || board.isInsufficientMaterial() || board.isThreefoldRepetition()) return false;
    const attacker = board.turn() === solver;
    if (attacker) {
      const preferred = hints.get(board.fen()) ?? [];
      legal.sort((a, b) => Number(preferred.includes(b.lan)) - Number(preferred.includes(a.lan)) ||
        Number(b.san.endsWith("#")) - Number(a.san.endsWith("#")) ||
        Number(b.san.endsWith("+")) - Number(a.san.endsWith("+")));
    }
    for (const move of legal) {
      board.move(move);
      const wins = forced(plies - 1);
      board.undo();
      if (attacker ? wins : !wins) { memo.set(key, attacker); return attacker; }
    }
    memo.set(key, !attacker);
    return !attacker;
  }
  // Each printed solver move must still force mate, including alternative book defenses.
  for (const line of authored) {
    for (let i = 0; i < line.moves.length; i++) {
      playUci(board, line.moves[i]);
      if (i % 2 === 0 && !forced(maxPlies - i - 1)) throw new LearningError("An authored solver move does not force mate against every defense.");
    }
    for (let i = 0; i < line.moves.length; i++) board.undo();
  }
  const lines: PuzzleSolution["lines"] = [];
  function collect(plies: number, prefix: string[]) {
    budget();
    if (board.isCheckmate()) {
      if (lines.length >= 1024) throw new LearningError("Too many practice continuations.");
      lines.push({ moves: prefix, goal: "mate" });
      return;
    }
    if (plies <= 0) throw new LearningError("A practice continuation exceeded the mate bound.");
    const legal = board.moves({ verbose: true }).sort((a, b) => a.lan.localeCompare(b.lan));
    if (board.turn() !== solver) {
      const selected = legal.find(move => move.lan === replies.get(prefix.join(" "))) ?? legal[0];
      if (!selected) throw new LearningError("A practice continuation ended without mate.");
      board.move(selected);
      collect(plies - 1, [...prefix, selected.lan]);
      board.undo();
      return;
    }
    for (const move of legal) {
      board.move(move);
      if (forced(plies - 1)) collect(plies - 1, [...prefix, move.lan]);
      board.undo();
    }
  }
  // Restrict the opening to the proven book moves; subsequent solver alternatives are collected exhaustively.
  for (const root of roots) {
    playUci(board, root);
    collect(maxPlies - 1, [root]);
    board.undo();
  }
  const solution: PuzzleSolution = { version: 2, maxPlayerMoves: 4, lines };
  readSolution(solution, content.fen, roots, content.solver);
  return { method: "exhaustive-authored-root-mate-v1", nodes, solution, acceptedMoves: roots, fingerprint: answerIdentity(content) };
}
