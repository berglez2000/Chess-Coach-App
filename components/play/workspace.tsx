"use client";
import { useEffect, useRef, useState } from "react";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { useHydrated } from "@/components/auth/use-hydrated";
import { ReplayBoard } from "@/components/chess/replay-board";
import { PromotionPicker } from "@/components/chess/promotion-picker";
import { useMoveSound } from "@/components/chess/use-move-sound";
import { PositionAnalysisPanel } from "@/components/analysis/position-panel";
import { validatePosition } from "@/lib/position-analysis/contract";
import { DIFFICULTIES, type Difficulty } from "@/lib/play/contract";
import { MillenniumBoard, type PhysicalStatus } from "./millennium-board";
import styles from "@/components/analysis/analysis.module.css";
export function PlayWorkspace() {
  const hydrated = useHydrated();
  const [millennium, setMillennium] = useState(false);
  const [physical, setPhysical] = useState<PhysicalStatus>({ connected: false, placement: null });
  const [fenInput, setFenInput] = useState(DEFAULT_POSITION);
  const [color, setColor] = useState<"WHITE" | "BLACK">("WHITE");
  const [difficulty, setDifficulty] = useState<Difficulty>("casual");
  const [game, setGame] = useState<{ startFen: string; color: "WHITE" | "BLACK"; difficulty: Difficulty; moves: string[]; id: number } | null>(null);
  const [resigned, setResigned] = useState(false);
  const [paused, setPaused] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [analysis, setAnalysis] = useState(false);
  const [retry, setRetry] = useState(0);
  const [coordinates, setCoordinates] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const sound = useMoveSound(); const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  const board = new Chess(game?.startFen ?? DEFAULT_POSITION); for (const move of game?.moves ?? []) board.move(move);
  const fen = board.fen(); const ended = resigned || board.isGameOver();
  const humanTurn = !!game && board.turn() === (game.color === "WHITE" ? "w" : "b");
  const physicalReady = !millennium || (physical.connected && physical.placement === fen.split(" ")[0]);
  const canMove = !!game && humanTurn && !ended && !paused && !analysis;
  useEffect(() => {
    if (!game || resigned || paused || analysis || !physicalReady) return;
    const position = new Chess(game.startFen); for (const move of game.moves) position.move(move);
    if (position.isGameOver() || position.turn() === (game.color === "WHITE" ? "w" : "b")) return;
    const controller = new AbortController(); request.current = controller;
    let active = true;
    async function reply() {
      setThinking(true); setError("");
      try {
        const response = await fetch("/api/play", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ startFen: game!.startFen, moves: game!.moves, color: game!.color, difficulty: game!.difficulty }) });
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
  }, [game, resigned, paused, analysis, retry, physicalReady]);
  function start() {
    try {
      const startFen = validatePosition(fenInput).fen(); request.current?.abort();
      setGame({ startFen, color, difficulty, moves: [], id: Date.now() });
      setResigned(false); setPaused(false); setThinking(false); setAnalysis(false); setPromotion(null); setSelected(null); setCoordinates(""); setError("");
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
  function download() {
    board.header("Event", "Chess Coach practice", "White", game?.color === "WHITE" ? "Player" : "Stockfish", "Black", game?.color === "BLACK" ? "Player" : "Stockfish", "Result", result);
    const url = URL.createObjectURL(new Blob([board.pgn()], { type: "application/x-chess-pgn" }));
    const link = document.createElement("a"); link.href = url; link.download = "stockfish-practice.pgn"; link.click(); URL.revokeObjectURL(url);
  }
  return <div className={styles.layout}><section className={`${styles.card} ${styles.stack}`} aria-label="Stockfish game">
    <ReplayBoard fen={fen} userColor={game?.color ?? color} flipped={flipped} positionLabel="Stockfish play" lastMove={game?.moves.at(-1)} selectedSquare={selected} onMove={canMove && !millennium ? play : undefined} onSquareClick={canMove && !millennium ? square => { if (board.get(square as Parameters<typeof board.get>[0])?.color === board.turn()) setSelected(square); else if (selected) play(selected, square); } : undefined} />
    <p role="status" aria-label="Game status">{!game ? "Choose your settings and start a game." : ended ? `${resigned ? "Resigned" : board.isCheckmate() ? "Checkmate" : board.isStalemate() ? "Stalemate" : "Draw"} · ${result}` : analysis ? "Analysis assistance enabled · Play paused" : paused ? "Play paused" : !physicalReady ? "Synchronize the physical board with the position shown" : thinking || !humanTurn ? "Stockfish to move" : `Your turn${board.isCheck() ? " · Check" : ""}`}</p>
    <div className={styles.actions}><button className={styles.button} onClick={() => setFlipped(!flipped)}>Flip board</button><button className={styles.button} onClick={sound.toggleMuted}>{sound.muted ? "Unmute moves" : "Mute moves"}</button>
    {game && !ended && <><button className={styles.button} disabled={analysis} onClick={() => { request.current?.abort(); setThinking(false); setPaused(!paused); setRetry(retry + 1); }}>{paused ? "Resume / retry engine" : "Pause"}</button><button className={styles.button} onClick={() => { request.current?.abort(); setThinking(false); setResigned(true); setPromotion(null); }}>Resign</button></>}
    {game && <button className={styles.button} onClick={download}>Download PGN</button>}</div>
    <form className={styles.actions} onSubmit={event => { event.preventDefault(); const uci = coordinates.trim().toLowerCase(); if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) { setError("Enter coordinates such as e2e4 or a7a8n."); return; } play(uci.slice(0,2), uci.slice(2,4), uci[4]); }}><label className={styles.field}>Move coordinates<input disabled={!canMove || millennium} value={coordinates} onChange={event => setCoordinates(event.target.value)} /></label><button className={styles.button} disabled={!canMove || millennium}>Play move</button></form>
    {promotion && canMove && <PromotionPicker color={board.turn()} onCancel={() => setPromotion(null)} onChoose={piece => { play(promotion.from, promotion.to, piece); setPromotion(null); }} />}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p aria-label="Game moves">{board.history({ verbose: true }).map(move => `${move.before.split(" ")[5]}${move.color === "w" ? "." : "…"} ${move.san}`).join(" ") || "No moves yet"}</p>
    <p className={styles.fen}>{fen}</p>
  </section><section className={`${styles.card} ${styles.stack}`} aria-label="Play settings">
    <label className={styles.limit}>Move input<select disabled={!hydrated} aria-label="Move input" value={millennium ? "millennium" : "screen"} onChange={event => { request.current?.abort(); setThinking(false); setPaused(Boolean(game)); setPhysical({ connected: false, placement: null }); setMillennium(event.target.value === "millennium"); setSelected(null); setPromotion(null); }}><option value="screen">On-screen board</option><option value="millennium">Millennium board (ChessLink)</option></select></label>
    {millennium && <MillenniumBoard guideMove={!!game && !resigned && !paused && !analysis && board.history({ verbose: true }).at(-1)?.color === (game.color === "WHITE" ? "b" : "w")} sessionId={game?.id ?? 0} fen={fen} acceptMoves={canMove} onMove={uci => play(uci.slice(0,2), uci.slice(2,4), uci[4], true)} onStatus={setPhysical} onDisconnect={() => { request.current?.abort(); setThinking(false); setPaused(Boolean(game)); }} />}
    {game && millennium && game.moves.length > 0 && <p className={styles.muted}>Last move: {board.history().at(-1)} ({game.moves.at(-1)}). Match the displayed board before playing your next move.</p>}
    <label className={styles.limit}>Your color<select disabled={!hydrated} aria-label="Your color" value={color} onChange={event => setColor(event.target.value as typeof color)}><option value="WHITE">White</option><option value="BLACK">Black</option></select></label>
    <label className={styles.limit}>Difficulty<select disabled={!hydrated} aria-label="Difficulty" value={difficulty} onChange={event => setDifficulty(event.target.value as Difficulty)}>{Object.entries(DIFFICULTIES).map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
    <p className={styles.muted}>Difficulty uses Stockfish skill levels, with 0.25–2 seconds per reply. These presets are not calibrated Elo ratings. No clock is used.</p>
    <label className={styles.field}>Starting FEN<input disabled={!hydrated} value={fenInput} maxLength={200} onChange={event => setFenInput(event.target.value)} /></label>
    <button className={styles.button} onClick={() => setFenInput(DEFAULT_POSITION)}>Use normal starting position</button>
    <button className={styles.button} disabled={!hydrated} onClick={start}>{game ? "Restart with these settings" : "Start game"}</button>
    <p className={styles.muted}>Restart replaces the current game. Download PGN first to keep it. Games are temporary; refreshing clears the session. Import your downloaded PGN in My Games to save and review it.</p>
    {game && <><button className={styles.button} aria-pressed={analysis} onClick={() => { request.current?.abort(); setThinking(false); setAnalysis(!analysis); setSelected(null); setPromotion(null); }}> {analysis ? "Close analysis" : "Show analysis assistance"}</button>{analysis && <PositionAnalysisPanel key={game.id} position={{ startFen: game.startFen, moves: game.moves }} whiteBottom={(game.color === "WHITE") !== flipped} />}</>}
  </section></div>;
}
