"use client";
import { useState } from "react";
import { useMoveSound } from "@/components/chess/use-move-sound";
import { ReplayBoard } from "@/components/chess/replay-board";
import { PromotionPicker } from "@/components/chess/promotion-picker";
import { position, type OpeningContent } from "@/lib/openings/content";
import styles from "./openings.module.css";
export function MoveBoard({ content, moves, onPlay, disabled = false, sound, onFlip }: { content: OpeningContent; moves: string[]; onPlay: (uci: string) => boolean; disabled?: boolean; sound?: ReturnType<typeof useMoveSound>; onFlip?: (flipped: boolean) => void }) {
  const [selected, setSelected] = useState<{ fen: string; square: string } | null>(null);
  const [promotion, setPromotion] = useState<{ fen: string; from: string; to: string } | null>(null);
  const [coordinates, setCoordinates] = useState("");
  const [error, setError] = useState("");
  const [flipped, setFlipped] = useState(false);
  const localSound = useMoveSound();
  const audio = sound ?? localSound;
  const chess = position(content.startFen, moves);
  const fen = moves.length ? chess.fen() : content.startFen;
  function play(from: string, to: string, promote?: string) {
    if (disabled) return false;
    setSelected(null); setError("");
    if (!promote && chess.moves({ verbose: true }).some(move => move.from === from && move.to === to && move.promotion)) { setPromotion({ fen, from, to }); return false; }
    const accepted = onPlay(`${from}${to}${promote ?? ""}`);
    if (accepted) {
      setCoordinates("");
      const move = chess.move(`${from}${to}${promote ?? ""}`);
      audio.play(move.san, chess.isGameOver());
    }
    return accepted;
  }
  return <div className={styles.stack}>
    <ReplayBoard fen={fen} userColor={content.color} flipped={flipped} lastMove={moves.at(-1)} positionLabel="Opening" selectedSquare={selected?.fen === fen ? selected.square : null}
      onMove={disabled ? undefined : play} onSquareClick={disabled ? undefined : square => {
        const piece = chess.get(square as Parameters<typeof chess.get>[0]);
        if (piece?.color === chess.turn()) setSelected({ fen, square });
        else if (selected?.fen === fen) play(selected.square, square);
      }} />
    <div className={styles.actions}><span className={styles.muted}>{chess.isCheckmate() ? "Checkmate" : chess.isStalemate() ? "Stalemate" : chess.isDraw() ? "Draw" : `${chess.turn() === "w" ? "White" : "Black"} to move${chess.isCheck() ? " · Check" : ""}`}</span><button type="button" className={styles.button} onClick={() => { setFlipped(!flipped); onFlip?.(!flipped); }}>Flip board</button><button type="button" className={styles.button} aria-pressed={audio.muted} onClick={audio.toggleMuted}>{audio.muted ? "Unmute moves" : "Mute moves"}</button></div>
    <p className={styles.muted}>Drag a piece, select its source and destination squares, or enter coordinates.</p>
    <form onSubmit={event => { event.preventDefault(); const move = coordinates.trim().toLowerCase(); if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) { setError("Enter coordinates such as e2e4 or a7a8n."); return; } play(move.slice(0, 2), move.slice(2, 4), move[4]); }}>
      <label className={styles.field}>Move coordinates<input value={coordinates} disabled={disabled} onChange={event => setCoordinates(event.target.value)} placeholder="e2e4" /></label>
      <button className={styles.button} disabled={disabled}>Play move</button>
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {promotion?.fen === fen && <PromotionPicker color={chess.turn()} onCancel={() => setPromotion(null)} onChoose={piece => { play(promotion.from, promotion.to, piece); setPromotion(null); }} />}
  </div>;
}
