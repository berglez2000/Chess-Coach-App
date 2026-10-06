"use client";
import { useEffect, useRef, useState } from "react";
import { autoReply, candidates, complete, position, preferred, practiceMove, shuffledIndices, type OpeningContent, type PracticeState } from "@/lib/openings/content";
import { useMoveSound } from "@/components/chess/use-move-sound";
import { MoveBoard } from "./move-board";
import styles from "./openings.module.css";
export function OpeningPractice({ content }: { content: OpeningContent }) {
  const [state, setState] = useState<PracticeState | null>(null);
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const pool = useRef<number[]>([]);
  const sound = useMoveSound();
  const playSound = sound.play;
  const done = state ? complete(content, state) : false;
  const waiting = !!state && !done && !state.revealed && position(content.startFen, state.moves).turn() !== (content.color === "WHITE" ? "w" : "b");
  useEffect(() => {
    if (!state || !waiting) return;
    const timer = window.setTimeout(() => {
      const next = autoReply(content, state);
      const chess = position(content.startFen, state.moves);
      const move = chess.move(next.moves.at(-1)!);
      playSound(move.san, chess.isGameOver());
      setState(next);
      setMessage(`Opponent played ${move.san}.`);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [content, state, waiting, playSound]);
  function begin(next = false) {
    if (!content.lines.length) return;
    if (next && state) pool.current = pool.current.filter(index => index !== state.target);
    if (!pool.current.length) pool.current = shuffledIndices(content.lines.length, state?.target);
    const target = next || !state ? pool.current[0] : state.target;
    setState({ target, moves: [], assisted: false, revealed: false });
    setHint(""); setMessage("");
  }
  function play(uci: string) {
    if (!state || waiting) return false;
    const result = practiceMove(content, state, uci);
    setState(result.state); setHint("");
    setMessage(result.outcome === "ILLEGAL" ? "Illegal move. Try another move." : result.outcome === "INCORRECT" ? "That move is not in a saved branch. Try again; the position is unchanged." : "Correct move.");
    return result.outcome === "CORRECT";
  }
  return <div className={styles.stack}>
    <p className={styles.muted}>Practice as {content.color === "WHITE" ? "White" : "Black"}. Any saved branch is accepted. Opponent moves come from your variations. Practice stays in this session; reloading starts again.</p>
    {!state ? <div className={styles.card}><h2>{content.lines.length ? "Ready to practice?" : "No variations yet"}</h2><p className={styles.muted}>Variations are shuffled without repetition until the cycle is finished.</p><button className={styles.primary} disabled={!content.lines.length} onClick={() => begin()}>Start practice</button></div> : <div className={styles.layout}>
      <div className={`${styles.card} ${styles.boardCard}`}><MoveBoard content={content} moves={state.moves} onPlay={play} disabled={done || state.revealed || waiting} sound={sound} /></div>
      <div className={`${styles.card} ${styles.stack}`}>
        <h2>{done ? "Variation complete" : state.revealed ? "Solution revealed" : waiting ? "Opponent is thinking…" : "Your move"}</h2>
        {done && <p className={styles.status} role="status">{content.lines[state.target].name} · {state.assisted ? "Completed with assistance" : "Completed without hints"}</p>}
        {message && <p role="status" aria-label="Practice feedback" className={styles.status}>{message}</p>}
        {hint && <p role="status" className={styles.status}>{hint}</p>}
        <p className={styles.muted}>Played: {position(content.startFen, state.moves).history().join(" · ") || "No moves yet"}</p>
        <div className={styles.actions}>
          <button className={styles.button} disabled={done || state.revealed || waiting} onClick={() => { const chess = position(content.startFen, state.moves); const next = preferred(content, state); if (!next) return; const move = next.line.moves[state.moves.length]; setHint(`Try ${chess.move(move).san}.`); setState({ ...state, assisted: true }); }}>Hint</button>
          <button className={styles.button} disabled={done || state.revealed} onClick={() => setState({ ...state, assisted: true, revealed: true })}>Reveal</button>
          <button className={styles.button} onClick={() => { setState({ ...state, moves: [], revealed: false }); setHint(""); setMessage(""); }}>Retry variation</button>
          <button className={styles.primary} disabled={!done && !state.revealed} onClick={() => begin(true)}>Next variation</button>
        </div>
        {(done || state.revealed) && <div><h3>Authored solution</h3><p className={styles.description}>{position(content.startFen, preferred(content, state)!.line.moves).history().join(" · ")}</p></div>}
        {!done && !state.revealed && <p className={styles.muted}>{candidates(content, state).length} saved branches continue from this move sequence.</p>}
      </div>
    </div>}
  </div>;
}
