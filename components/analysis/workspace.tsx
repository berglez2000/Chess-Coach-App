"use client";
import { useState } from "react";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { ReplayBoard } from "@/components/chess/replay-board";
import { PromotionPicker } from "@/components/chess/promotion-picker";
import { useMoveSound } from "@/components/chess/use-move-sound";
import { validatePosition } from "@/lib/position-analysis/contract";
import { PositionAnalysisPanel } from "./position-panel";
import styles from "./analysis.module.css";
export function AnalysisWorkspace() {
  const [startFen, setStartFen] = useState(DEFAULT_POSITION);
  const [fenInput, setFenInput] = useState(DEFAULT_POSITION);
  const [moves, setMoves] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<{ fen: string; square: string } | null>(null);
  const [promotion, setPromotion] = useState<{ fen: string; from: string; to: string } | null>(null);
  const [coordinates, setCoordinates] = useState("");
  const [error, setError] = useState("");
  const sound = useMoveSound();
  const board = new Chess(startFen); for (const move of moves.slice(0, cursor)) board.move(move);
  const fen = board.fen();
  const all = new Chess(startFen); for (const move of moves) all.move(move);
  function navigate(index: number) { setCursor(index); setSelected(null); setPromotion(null); setError(""); }
  function play(from: string, to: string, promote?: string) {
    setSelected(null);
    if (board.isGameOver()) { setError("This position has ended. Go back or reset to continue."); return false; }
    if (cursor >= 400) { setError("This exploration has reached 400 half-moves. Load a new starting FEN to continue."); return false; }
    if (!promote && board.moves({ verbose: true }).some(move => move.from === from && move.to === to && move.promotion)) { setPromotion({ fen, from, to }); return false; }
    try {
      const move = board.move({ from, to, promotion: promote });
      setMoves([...moves.slice(0, cursor), move.lan]); setCursor(cursor + 1); setCoordinates(""); setError(""); sound.play(move.san, board.isGameOver()); return true;
    } catch { setError("Illegal move. Try another move."); return false; }
  }
  function load(fen: string) {
    try { const next = validatePosition(fen).fen(); setStartFen(next); setFenInput(next); setMoves([]); navigate(0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Enter a legal starting FEN."); }
  }
  return <div className={styles.layout}>
    <section className={`${styles.card} ${styles.stack}`} aria-label="Analysis board">
      <ReplayBoard fen={fen} userColor="WHITE" flipped={flipped} positionLabel="Analysis" lastMove={moves[cursor - 1]} selectedSquare={selected?.fen === fen ? selected.square : null} onMove={play} onSquareClick={square => { if (board.get(square as Parameters<typeof board.get>[0])?.color === board.turn()) setSelected({ fen, square }); else if (selected?.fen === fen) play(selected.square, square); }} />
      <p role="status" aria-label="Board status" className={styles.muted}>{board.isCheckmate() ? "Checkmate" : board.isStalemate() ? "Stalemate" : board.isDraw() ? "Draw" : `${board.turn() === "w" ? "White" : "Black"} to move${board.isCheck() ? " · Check" : ""}`}</p>
      <div className={styles.actions}><button className={styles.button} disabled={!cursor} onClick={() => navigate(0)}>Start</button><button className={styles.button} disabled={!cursor} onClick={() => navigate(cursor - 1)}>Previous</button><button className={styles.button} disabled={cursor === moves.length} onClick={() => navigate(cursor + 1)}>Next</button><button className={styles.button} disabled={cursor === moves.length} onClick={() => navigate(moves.length)}>End</button><button className={styles.button} onClick={() => { setMoves([]); navigate(0); }}>Reset variation</button></div>
      <div className={styles.actions}><button className={styles.button} aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>Flip board</button><button className={styles.button} aria-pressed={sound.muted} onClick={sound.toggleMuted}>{sound.muted ? "Unmute moves" : "Mute moves"}</button></div>
      <p className={styles.muted}>Play either side. Select an earlier move and play a different move to replace the continuation. Moves remain temporary.</p>
      <form className={styles.actions} onSubmit={event => { event.preventDefault(); const uci = coordinates.trim().toLowerCase(); if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) { setError("Enter coordinates such as e2e4 or a7a8n."); return; } play(uci.slice(0, 2), uci.slice(2, 4), uci[4]); }}><label className={styles.field}>Move coordinates<input value={coordinates} onChange={event => setCoordinates(event.target.value)} placeholder="e2e4" /></label><button className={styles.button}>Play move</button></form>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {promotion?.fen === fen && <PromotionPicker color={board.turn()} onCancel={() => setPromotion(null)} onChoose={piece => { play(promotion.from, promotion.to, piece); setPromotion(null); }} />}
      <div className={styles.moves} aria-label="Explored moves">{all.history({ verbose: true }).map((move, index) => <button className={styles.move} key={index} aria-pressed={cursor === index + 1} onClick={() => navigate(index + 1)}>{move.before.split(" ")[5]}{move.color === "w" ? "." : "…"} {move.san}</button>)}</div>
      <details><summary>Starting position</summary><form className={styles.stack} onSubmit={event => { event.preventDefault(); load(fenInput); }}><label className={styles.field}>Starting FEN<input value={fenInput} onChange={event => setFenInput(event.target.value)} maxLength={200} /></label><p className={styles.muted}>Loading a position clears the temporary variation.</p><div className={styles.actions}><button className={styles.button}>Load position</button><button type="button" className={styles.button} onClick={() => load(DEFAULT_POSITION)}>Normal starting position</button></div></form></details>
      <p className={styles.fen} aria-label="Current FEN">{fen}</p>
    </section>
    <PositionAnalysisPanel position={{ startFen, moves: moves.slice(0, cursor) }} whiteBottom={!flipped} onPlay={line => { const move = line[0]; play(move.slice(0, 2), move.slice(2, 4), move[4]); }} />
  </div>;
}
