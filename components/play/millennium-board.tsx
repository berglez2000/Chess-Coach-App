"use client";
import { useEffect, useRef, useState } from "react";
import { ChessLinkConnection, browserBluetooth } from "@/lib/chesslink/bluetooth";
import { squaresToPlacement } from "@/lib/chesslink/protocol";
import { physicalMove, differingSquares } from "@/lib/play/physical-board";
import styles from "@/components/analysis/analysis.module.css";
export type PhysicalStatus = { connected: boolean; placement: string | null };
export function MillenniumBoard({ fen, sessionId, guideMove, acceptMoves, onMove, onStatus, onDisconnect }: {
  fen: string; sessionId: number; guideMove: boolean; acceptMoves: boolean; onMove: (uci: string) => void;
  onStatus: (status: PhysicalStatus) => void; onDisconnect: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [placement, setPlacement] = useState<string | null>(null);
  const [message, setMessage] = useState("Connect ChessLink and match the position shown.");
  const [calibrated, setCalibrated] = useState(false);
  const armed = useRef<string | null>(null);
  const [reverse, setReverse] = useState(false);
  const [listenOnly, setListenOnly] = useState(false);
  const [ledEnabled, setLedEnabled] = useState(true);
  const [ledRetry, setLedRetry] = useState(0);
  const [ledMessage, setLedMessage] = useState("LED prompts enabled");
  const [querying, setQuerying] = useState(false);
  const link = useRef<ChessLinkConnection | null>(null);
  const order = useRef<boolean | null>(null);
  const report = useRef<string | null>(null);
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const current = useRef({ fen, sessionId, acceptMoves, onMove, onStatus, onDisconnect });
  useEffect(() => { current.current = { fen, sessionId, acceptMoves, onMove, onStatus, onDisconnect }; }, [fen, sessionId, acceptMoves, onMove, onStatus, onDisconnect]);
  useEffect(() => { armed.current = report.current === fen.split(" ")[0] ? fen : null; }, [fen, sessionId]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) { if (timer.current) clearTimeout(timer.current); report.current = null; setPlacement(null); current.current.onStatus({ connected: ready.current, placement: null }); current.current.onDisconnect(); setMessage("Tab was hidden. Query the position and resume after synchronizing."); } };
    document.addEventListener("visibilitychange", hidden);
    const invalidate = () => { generation.current++; };
    return () => { invalidate(); void link.current?.closeWithLeds().catch(() => {}); if (timer.current) clearTimeout(timer.current); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  useEffect(() => {
    const connection = link.current;
    if (!connected || !connection) return;
    let active = true;
    const squares = ledEnabled && guideMove && calibrated && placement ? differingSquares(placement, fen) : [];
    const output = squares.length ? connection.showLedSquares(squares, reverse) : connection.clearLeds();
    void output.then(() => {
      if (active) setLedMessage(!ledEnabled ? "LED prompts disabled" : squares.length ? `LED prompt sent: ${squares.join(" ")}` : "LED prompts ready · Board synchronized or no engine move pending");
    }).catch(() => { if (active) setLedMessage("LED output failed. Reconnect and retry LED prompt; the move remains on screen."); });
    return () => { active = false; };
  }, [connected, ledEnabled, guideMove, calibrated, placement, fen, reverse, sessionId, ledRetry]);
  function disconnected() {
    ready.current = false; report.current = null; armed.current = null; setConnected(false); setPlacement(null);
    if (timer.current) clearTimeout(timer.current);
    current.current.onStatus({ connected: false, placement: null }); current.current.onDisconnect();
    setMessage("Board disconnected. Reconnect, match the position shown, then resume play.");
  }
  async function connect() {
    const access = browserBluetooth();
    if (!access || !window.isSecureContext) { setMessage("Use desktop Chrome with Bluetooth enabled on HTTPS or localhost."); return; }
    const attempt = ++generation.current; link.current?.close(); disconnected(); setConnecting(true); order.current = null; setCalibrated(false);
    const connection = new ChessLinkConnection(event => {
      if (attempt !== generation.current || event.kind !== "position") return;
      const expected = current.current.fen.split(" ")[0];
      if (order.current === null) {
        const forward = squaresToPlacement(event.squares); const backward = squaresToPlacement(event.squares, true);
        if (forward === expected || backward === expected) { order.current = backward === expected; setReverse(order.current); setCalibrated(true); }
        else { setMessage("Set up the exact position shown to calibrate ChessLink square order."); return; }
      }
      const next = squaresToPlacement(event.squares, order.current);
      const changed = report.current !== next;
      report.current = next; setPlacement(next); current.current.onStatus({ connected: ready.current, placement: next });
      if (!changed && next !== expected) return;
      if (timer.current) clearTimeout(timer.current);
      if (next === expected) { armed.current = current.current.fen; setMessage("Physical board synchronized."); return; }
      setMessage("Board changed. Waiting for the completed move or Stockfish position.");
      const expectedFen = current.current.fen; const expectedSession = current.current.sessionId;
      timer.current = setTimeout(() => {
        const state = current.current;
        if (attempt !== generation.current || !ready.current || document.hidden || state.fen !== expectedFen || state.sessionId !== expectedSession || report.current !== next) return;
        if (!state.acceptMoves || armed.current !== state.fen) { setMessage("Reproduce the position shown on the physical board before continuing."); return; }
        const match = physicalMove(state.fen, next);
        if (match.kind === "move") { setMessage(`Accepted physical move ${match.uci}.`); state.onMove(match.uci); }
        else if (match.kind === "incomplete") setMessage("Move in progress. Complete all piece movements.");
        else if (match.kind === "mismatch") { setMessage("Unexpected position. Restore the position shown, then resume play."); state.onDisconnect(); }
      }, 800);
    }, disconnected, diagnostic => { if (attempt !== generation.current) return; if (diagnostic.startsWith("LED output failed")) setLedMessage("LED output failed. Reconnect and retry LED prompt; the move remains on screen."); if (diagnostic.startsWith("Discarded")) setMessage("Unsupported board data. Query the position or reconnect."); });
    link.current = connection;
    try {
      await connection.connect(access, listenOnly);
      if (attempt !== generation.current) return;
      ready.current = true; setConnected(true); current.current.onStatus({ connected: true, placement: report.current });
      setMessage(report.current ? "Board connected. Check synchronization and resume play." : "Connected; waiting for position. Use Query position if needed.");
    } catch { if (attempt === generation.current) { disconnected(); setMessage("Could not connect. Close other board apps, check ChessLink power, and retry."); } }
    finally { if (attempt === generation.current) setConnecting(false); }
  }
  async function query() {
    setQuerying(true);
    try { await link.current?.queryOnce("S"); }
    catch { setMessage("Position query failed. Reconnect ChessLink and try again."); }
    finally { setQuerying(false); }
  }
  const synchronized = connected && placement === fen.split(" ")[0];
  return <section className={styles.stack} aria-label="Millennium board connection">
    <p className={styles.muted}>Put the King Performance in CLink mode and close other board apps. Stockfish is the opponent. Move its replies on the physical board using the screen; LED prompts mark the pieces and squares needed to complete its reply.</p>
    <label><input type="checkbox" checked={ledEnabled} onChange={event => setLedEnabled(event.target.checked)} /> Stockfish LED prompts</label>
    <p role="status" aria-label="LED status">{ledMessage}</p>
    <button className={styles.button} disabled={!connected || !ledEnabled} onClick={() => setLedRetry(value => value + 1)}>Retry LED prompt</button>
    <label><input type="checkbox" checked={listenOnly} disabled={connected || connecting} onChange={event => setListenOnly(event.target.checked)} /> Skip initial queries (LED prompts still enabled)</label>
    <div className={styles.actions}><button className={styles.button} disabled={connecting} onClick={connect}>{connecting ? "Connecting board…" : connected ? "Reconnect Millennium board" : "Connect Millennium board"}</button><button className={styles.button} disabled={!connected || querying} onClick={query}>Query position</button><button className={styles.button} disabled={!connected && !connecting} onClick={() => { generation.current++; const connection = link.current; setConnecting(false); disconnected(); void connection?.closeWithLeds().catch(() => {}); }}>Disconnect Millennium board</button></div>
    <p role="status" aria-label="Physical board status">{synchronized ? "Synchronized" : connected ? "Waiting for matching physical position" : "Disconnected"}{calibrated ? ` · ${reverse ? "Reversed" : "Forward"} square order` : ""}</p>
    <p>{message}</p>
  </section>;
}
