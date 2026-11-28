"use client";

import { useEffect, useRef, useState } from "react";
import type { ChessColor } from "@/types/game";
import { explorationFen, explorationPosition } from "@/lib/pgn/exploration";
import { DIFFICULTIES, type Difficulty } from "@/lib/play/contract";
import { PromotionPicker } from "./promotion-picker";
import { ReplayBoard } from "./replay-board";

const buttonClass = "rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed";
const MOVE_LIMIT = 400;

/** Play a review position on against Stockfish. The player keeps their game colour; nothing is saved. */
export function PracticeBoard({ startFen, userColor, flipped, onSound, onExit }: {
  startFen: string; userColor: ChessColor; flipped: boolean; onSound: (san: string, gameOver: boolean) => void; onExit: () => void;
}) {
  const [moves, setMoves] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("strong");
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const sound = useRef(onSound);
  useEffect(() => { sound.current = onSound; }, [onSound]);

  const human = userColor === "WHITE" ? "w" : "b";
  const board = explorationPosition({ startFen, moves });
  const over = board.isGameOver();
  const full = moves.length >= MOVE_LIMIT;
  const humanTurn = board.turn() === human;
  const canMove = humanTurn && !over && !full;
  const takeBackCount = humanTurn ? 2 : 1;

  useEffect(() => {
    const position = explorationPosition({ startFen, moves });
    if (position.isGameOver() || position.turn() === (userColor === "WHITE" ? "w" : "b") || moves.length >= MOVE_LIMIT) return;
    const controller = new AbortController();
    let active = true;
    async function reply() {
      try {
        let response: Response;
        // One engine search runs per player; a search that was just cancelled may still be winding down.
        for (let attempt = 0; ; attempt++) {
          response = await fetch("/api/play", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ startFen, moves, color: userColor, difficulty }) });
          if (response.status !== 429 || attempt === 4) break;
          await new Promise(resolve => setTimeout(resolve, 400));
          if (!active) return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "Stockfish could not reply.");
        if (!active) return;
        if (typeof data.move !== "string") throw new Error("Stockfish could not reply.");
        const move = position.move(data.move);
        sound.current(move.san, position.isGameOver());
        setMoves(previous => previous === moves ? [...previous, move.lan] : previous);
      } catch (cause) {
        if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Stockfish could not reply.");
      }
    }
    void reply();
    return () => { active = false; controller.abort(); };
  }, [startFen, moves, userColor, difficulty, retry]);

  function play(from: string, to: string, piece?: string) {
    if (!canMove) return false;
    setSelected(null);
    if (!piece && board.moves({ verbose: true }).some(move => move.from === from && move.to === to && move.promotion)) { setPromotion({ from, to }); return false; }
    try {
      const move = board.move({ from, to, promotion: piece });
      setMoves([...moves, move.lan]);
      onSound(move.san, board.isGameOver());
      return true;
    } catch { return false; }
  }
  function rewind(length: number) {
    setMoves(moves.slice(0, length));
    setSelected(null); setPromotion(null); setError("");
  }

  const outcome = board.isCheckmate() ? (humanTurn ? "Checkmate · Stockfish won" : "Checkmate · You won") : board.isStalemate() ? "Stalemate · Draw" : "Draw";
  const status = over ? outcome : full ? "Move limit reached" : error ? "Stockfish is paused" : humanTurn ? `Your turn${board.isCheck() ? " · Check" : ""}` : "Stockfish is thinking…";
  return <div className="min-w-0">
    <p className="mb-3 rounded-lg bg-[var(--green-subtle)] p-3 text-sm"><strong>Playing on against Stockfish</strong> · You are {userColor === "WHITE" ? "White" : "Black"}. This practice game is temporary and is not saved.</p>
    <ReplayBoard fen={explorationFen({ startFen, moves })} userColor={userColor} flipped={flipped} positionLabel="Practice"
      lastMove={moves.at(-1)} selectedSquare={selected} onMove={canMove ? play : undefined}
      onSquareClick={canMove ? square => {
        if (board.get(square as Parameters<typeof board.get>[0])?.color === human) setSelected(square);
        else if (selected) play(selected, square);
      } : undefined} />
    {promotion && canMove && <PromotionPicker color={human} onCancel={() => setPromotion(null)} onChoose={piece => { play(promotion.from, promotion.to, piece); setPromotion(null); }} />}
    <p role="status" aria-label="Practice status" className="mt-3 text-sm font-medium">{status}</p>
    {error && !over && <div role="alert" className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--status-error)]">
      <span>{error}</span>
      <button type="button" className={`${buttonClass} text-[var(--fg)]`} onClick={() => { setError(""); setRetry(retry + 1); }}>Retry</button>
    </div>}
    <p className="mt-2 text-sm" aria-label="Practice moves">{board.history({ verbose: true }).map(move => `${move.before.split(" ")[5]}${move.color === "w" ? "." : "…"} ${move.san}`).join(" ") || "No moves yet"}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass} disabled={moves.length < takeBackCount} onClick={() => rewind(moves.length - takeBackCount)}>Take back</button>
      <button type="button" className={buttonClass} disabled={!moves.length} onClick={() => rewind(0)}>Start again</button>
      <button type="button" className={buttonClass} onClick={onExit}>Return to review</button>
      <label className="ml-auto flex items-center gap-2 text-sm">Engine strength
        <select className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2" value={difficulty} onChange={event => { setDifficulty(event.target.value as Difficulty); setError(""); }}>
          {Object.entries(DIFFICULTIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
      </label>
    </div>
  </div>;
}
