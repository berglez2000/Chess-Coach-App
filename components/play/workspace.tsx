"use client";
import { useEffect, useRef, useState } from "react";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { useHydrated } from "@/components/auth/use-hydrated";
import { ReplayBoard } from "@/components/chess/replay-board";
import { PromotionPicker } from "@/components/chess/promotion-picker";
import { useMoveSound } from "@/components/chess/use-move-sound";
import { PositionAnalysisPanel } from "@/components/analysis/position-panel";
import { validatePosition } from "@/lib/position-analysis/contract";
import { DIFFICULTIES, OPPONENTS, MAIA_RATINGS, type Opponent, type Difficulty } from "@/lib/play/contract";
import { endgameFeedback, type EndgamePosition } from "@/lib/endgames/catalog";
import { useEndgameProgress } from "@/components/endgames/use-progress";
import type { EndgameProgress } from "@/lib/endgames/progress";
import { MillenniumBoard, type PhysicalStatus } from "./millennium-board";
import styles from "@/components/analysis/analysis.module.css";
export function PlayWorkspace({ endgame, initialProgress }: { endgame?: EndgamePosition; initialProgress?: EndgameProgress } = {}) {
  const restored = initialProgress?.snapshot;
  const hydrated = useHydrated();
  const [millennium, setMillennium] = useState(false);
  const [physical, setPhysical] = useState<PhysicalStatus>({ connected: false, placement: null });
  const [fenInput, setFenInput] = useState(endgame?.fen ?? DEFAULT_POSITION);
  const [color, setColor] = useState<"WHITE" | "BLACK">(endgame?.color ?? "WHITE");
  const [opponent, setOpponent] = useState<Opponent>("stockfish");
  const [difficulty, setDifficulty] = useState<Difficulty>(restored?.difficulty ?? "casual");
  const [game, setGame] = useState<{ startFen: string; color: "WHITE" | "BLACK"; difficulty: Difficulty; opponent: Opponent; moves: string[]; id: number; sessionId?: string } | null>(restored && endgame ? { startFen: endgame.fen, color: endgame.color, difficulty: restored.difficulty, opponent: "stockfish", moves: restored.moves, id: 0, sessionId: restored.sessionId } : null);
  const [hintShown, setHintShown] = useState(restored?.hintUsed ?? false);
  const [hintUsed, setHintUsed] = useState(restored?.hintUsed ?? false);
  const [analysisUsed, setAnalysisUsed] = useState(restored?.analysisUsed ?? false);
  const [resigned, setResigned] = useState(restored?.resigned ?? false);
  const [paused, setPaused] = useState(!!restored);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [analysis, setAnalysis] = useState(false);
  const [retry, setRetry] = useState(0);
  const [coordinates, setCoordinates] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const persistence = useEndgameProgress(endgame?.id, initialProgress, game?.sessionId ? { sessionId: game.sessionId, difficulty: game.difficulty, moves: game.moves, resigned, hintUsed, analysisUsed } : null);
  const sound = useMoveSound(); const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  const board = new Chess(game?.startFen ?? endgame?.fen ?? DEFAULT_POSITION); for (const move of game?.moves ?? []) board.move(move);
  const fen = board.fen(); const ended = resigned || board.isGameOver();
  const humanTurn = !!game && board.turn() === (game.color === "WHITE" ? "w" : "b");
  const physicalReady = !millennium || (physical.connected && physical.placement === fen.split(" ")[0]);
  const canMove = !!game && humanTurn && !ended && !paused && !analysis && persistence.ready;
  useEffect(() => {
    if (!game || resigned || paused || analysis || !physicalReady || !persistence.ready) return;
    const position = new Chess(game.startFen); for (const move of game.moves) position.move(move);
    if (position.isGameOver() || position.turn() === (game.color === "WHITE" ? "w" : "b")) return;
    const controller = new AbortController(); request.current = controller;
    let active = true;
    async function reply() {
      setThinking(true); setError("");
      try {
        const response = await fetch("/api/play", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ startFen: game!.startFen, moves: game!.moves, color: game!.color, difficulty: game!.difficulty, opponent: game!.opponent }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "Engine reply failed.");
        if (!active) return;
        if (data.fen !== position.fen() || typeof data.move !== "string") throw new Error("Invalid engine reply. Retry the search.");
        const move = position.move(data.move);
        soundRef.current.play(move.san, position.isGameOver());
        setGame(previous => previous && previous === game ? { ...previous, moves: [...previous.moves, move.lan] } : previous);
      } catch (cause) {
        if (active && !controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "Engine reply failed."); setPaused(true); }
      } finally { if (active) setThinking(false); }
    }
    void reply();
    return () => { active = false; controller.abort(); request.current = null; };
  }, [game, resigned, paused, analysis, retry, physicalReady, persistence.ready]);
  function start() {
    try {
      const startFen = validatePosition(fenInput).fen(); request.current?.abort();
      setGame({ startFen, color, difficulty, opponent, moves: [], id: Date.now(), ...(initialProgress ? { sessionId: crypto.randomUUID() } : {}) });
      setHintShown(false); setHintUsed(false); setAnalysisUsed(false); setResigned(false); setPaused(false); setThinking(false); setAnalysis(false); setPromotion(null); setSelected(null); setCoordinates(""); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid starting position."); }
  }
  function play(from: string, to: string, piece?: string, physicalInput = false) {
    if (!canMove || !game || (millennium && !physicalInput)) return false;
    setSelected(null);
    if (game.moves.length >= 400) { setPaused(true); setError("Reached the 400 half-move limit. Download this game before starting another."); return false; }
    if (!piece && board.moves({ verbose: true }).some(move => move.from === from && move.to === to && move.promotion)) { setPromotion({ from, to }); return false; }
    try { const move = board.move({ from, to, promotion: piece }); setGame({ ...game, moves: [...game.moves, move.lan] }); setCoordinates(""); setError(""); sound.play(move.san, board.isGameOver()); return true; }
    catch { setError("Illegal move. Try another move."); return false; }
  }
  const result = resigned ? game?.color === "WHITE" ? "0-1" : "1-0" : board.isCheckmate() ? board.turn() === "w" ? "0-1" : "1-0" : board.isDraw() ? "1/2-1/2" : "*";
  const opponentName = (game?.opponent ?? opponent) === "maia" ? "Maia" : "Stockfish";
  function download() {
    board.header("Event", "Chess Coach practice", "White", game?.color === "WHITE" ? "Player" : opponentName, "Black", game?.color === "BLACK" ? "Player" : opponentName, "Result", result);
    const url = URL.createObjectURL(new Blob([board.pgn()], { type: "application/x-chess-pgn" }));
    const link = document.createElement("a"); link.href = url; link.download = `${opponentName.toLowerCase()}-practice.pgn`; link.click(); URL.revokeObjectURL(url);
  }
  return <div className={styles.layout}><section className={`${styles.card} ${styles.stack}`} aria-label={`${opponentName} game`}>
    <ReplayBoard fen={fen} userColor={game?.color ?? color} flipped={flipped} positionLabel={`${opponentName} play`} lastMove={game?.moves.at(-1)} selectedSquare={selected} onMove={canMove && !millennium ? play : undefined} onSquareClick={canMove && !millennium ? square => { if (board.get(square as Parameters<typeof board.get>[0])?.color === board.turn()) setSelected(square); else if (selected) play(selected, square); } : undefined} />
    <p role="status" aria-label="Game status">{!game ? "Choose your settings and start a game." : ended ? `${resigned ? "Resigned" : board.isCheckmate() ? "Checkmate" : board.isStalemate() ? "Stalemate" : "Draw"} · ${result}` : !persistence.ready ? "Saving practice · Play paused" : analysis ? "Analysis assistance enabled · Play paused" : paused ? "Play paused" : !physicalReady ? "Synchronize the physical board with the position shown" : thinking || !humanTurn ? `${opponentName} to move` : `Your turn${board.isCheck() ? " · Check" : ""}`}</p>
    <div className={styles.actions}><button className={styles.button} onClick={() => setFlipped(!flipped)}>Flip board</button><button className={styles.button} onClick={sound.toggleMuted}>{sound.muted ? "Unmute moves" : "Mute moves"}</button>
    {game && !ended && <><button className={styles.button} disabled={analysis || !persistence.ready} onClick={() => { request.current?.abort(); setThinking(false); setPaused(!paused); setRetry(retry + 1); }}>{paused ? "Resume / retry engine" : "Pause"}</button><button className={styles.button} disabled={!persistence.ready} onClick={() => { request.current?.abort(); setThinking(false); setResigned(true); setPromotion(null); }}>Resign</button></>}
    {game && <button className={styles.button} onClick={download}>Download PGN</button>}</div>
    <form className={styles.actions} onSubmit={event => { event.preventDefault(); const uci = coordinates.trim().toLowerCase(); if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) { setError("Enter coordinates such as e2e4 or a7a8n."); return; } play(uci.slice(0,2), uci.slice(2,4), uci[4]); }}><label className={styles.field}>Move coordinates<input disabled={!canMove || millennium} value={coordinates} onChange={event => setCoordinates(event.target.value)} /></label><button className={styles.button} disabled={!canMove || millennium}>Play move</button></form>
    {promotion && canMove && <PromotionPicker color={board.turn()} onCancel={() => setPromotion(null)} onChoose={piece => { play(promotion.from, promotion.to, piece); setPromotion(null); }} />}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p aria-label="Game moves">{board.history({ verbose: true }).map(move => `${move.before.split(" ")[5]}${move.color === "w" ? "." : "…"} ${move.san}`).join(" ") || "No moves yet"}</p>
    <p className={styles.fen}>{fen}</p>
  </section><section className={`${styles.card} ${styles.stack}`} aria-label="Play settings">
    {endgame && <section className={styles.stack} aria-label="Endgame objective"><h2>{endgame.title}</h2><p>{endgame.description}</p>{endgame.source && <p className={styles.muted}>Position source: <a className="underline" href={endgame.source.url}>{endgame.source.name}</a> · {endgame.source.group}, position {endgame.source.position} · <a className="underline" href="/licenses/chess-endgame-training-GPL-3.0.txt">{endgame.source.license}</a></p>}{game && <p role="status" aria-label="Objective feedback">{endgameFeedback(endgame, board, resigned)}</p>}<button className={styles.button} disabled={hintShown || (persistence.enabled && (!game || !persistence.ready))} onClick={() => { setHintShown(true); setHintUsed(true); }}>Show endgame hint</button>{hintShown && <p>{endgame.hint}</p>}<p className={styles.muted}>Hints and analysis provide assistance. Objective feedback checks the final outcome; intermediate moves are not graded. {persistence.enabled ? "Attempts and the first completion are saved to your account." : "Practice progress is not saved."}</p></section>}
    <label className={styles.limit}>Move input<select disabled={!hydrated} aria-label="Move input" value={millennium ? "millennium" : "screen"} onChange={event => { request.current?.abort(); setThinking(false); setPaused(Boolean(game)); setPhysical({ connected: false, placement: null }); setMillennium(event.target.value === "millennium"); setSelected(null); setPromotion(null); }}><option value="screen">On-screen board</option><option value="millennium">Millennium board (ChessLink)</option></select></label>
    {millennium && <MillenniumBoard opponentName={opponentName} guideMove={!!game && !resigned && !paused && !analysis && board.history({ verbose: true }).at(-1)?.color === (game.color === "WHITE" ? "b" : "w")} sessionId={game?.id ?? 0} fen={fen} acceptMoves={canMove} onMove={uci => play(uci.slice(0,2), uci.slice(2,4), uci[4], true)} onStatus={setPhysical} onDisconnect={() => { request.current?.abort(); setThinking(false); setPaused(Boolean(game)); }} />}
    {game && millennium && game.moves.length > 0 && <p className={styles.muted}>Last move: {board.history().at(-1)} ({game.moves.at(-1)}). Match the displayed board before playing your next move.</p>}
    <label className={styles.limit}>Your color<select disabled={!hydrated || !!endgame} aria-label="Your color" value={color} onChange={event => setColor(event.target.value as typeof color)}><option value="WHITE">White</option><option value="BLACK">Black</option></select></label>
    <label className={styles.limit}>Opponent<select disabled={!hydrated || !!endgame} aria-label="Opponent" value={opponent} onChange={event => setOpponent(event.target.value as Opponent)}>{Object.entries(OPPONENTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className={styles.limit}>Difficulty<select disabled={!hydrated} aria-label="Difficulty" value={difficulty} onChange={event => setDifficulty(event.target.value as Difficulty)}>{Object.entries(DIFFICULTIES).map(([key,value]) => <option key={key} value={key}>{value.label}{opponent === "maia" ? ` · ${MAIA_RATINGS[key as Difficulty]}` : ""}</option>)}</select></label>
    <p className={styles.muted}>{opponent === "maia" ? "Maia predicts human moves at the selected rating, with varied replies. Ratings describe the modeled player level, not guaranteed playing strength. Requires a configured Maia engine on the server." : "Difficulty uses Stockfish skill levels, with 0.25–2 seconds per reply. These presets are not calibrated Elo ratings."} No clock is used.</p>
    <label className={styles.field}>Starting FEN<input disabled={!hydrated || !!endgame} value={fenInput} maxLength={200} onChange={event => setFenInput(event.target.value)} /></label>
    {!endgame && <button className={styles.button} onClick={() => setFenInput(DEFAULT_POSITION)}>Use normal starting position</button>}
    <button className={styles.button} disabled={!hydrated || !persistence.ready} onClick={start}>{game ? "Restart with these settings" : "Start game"}</button>
    <p className={styles.muted}>{persistence.enabled ? "Your game is saved after each move and resumes paused after reload. Restart begins a new attempt and retains your first completion. Download PGN to keep a copy of this attempt." : "Restart replaces the current game. Download PGN first to keep it. Games are temporary; refreshing clears the session. Import your downloaded PGN in My Games to save and review it."}</p>
    {persistence.enabled && <p role="status" aria-label="Saved practice progress">{persistence.progress?.completedAt ? `Completed ${persistence.progress.completionAssisted ? "with assistance" : "without assistance"} · ` : ""}{persistence.progress?.attempts ?? 0} attempts · {persistence.ready ? "Saved" : "Saving paused play"}</p>}
    {persistence.error && <div role="alert"><p>{persistence.error}</p><button className={styles.button} onClick={persistence.retry}>Retry save</button></div>}
    {game && <><button className={styles.button} aria-pressed={analysis} disabled={!persistence.ready} onClick={() => { request.current?.abort(); setThinking(false); setAnalysis(!analysis); if (!analysis) setAnalysisUsed(true); setSelected(null); setPromotion(null); }}> {analysis ? "Close analysis" : "Show analysis assistance"}</button>{analysis && <PositionAnalysisPanel key={game.id} position={{ startFen: game.startFen, moves: game.moves }} whiteBottom={(game.color === "WHITE") !== flipped} />}</>}
  </section></div>;
}
