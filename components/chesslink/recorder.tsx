"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ReplayBoard } from "@/components/chess/replay-board";
import { browserBluetooth, ChessLinkConnection } from "@/lib/chesslink/bluetooth";
import { squaresToPlacement } from "@/lib/chesslink/protocol";
import { isIncompleteMove, matchPosition, readDraft, reconstructMoves, recordingChess, recordingPgn, type RecordingDraft } from "@/lib/chesslink/recording";
import shared from "@/components/ui/simple-page.module.css";
import styles from "./recorder.module.css";

function newDraft(player: string): RecordingDraft {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { version: 1, id: crypto.randomUUID(), moves: [], color: "WHITE", rotated: false, player: player.slice(0, 100), date, result: "*", finished: false };
}

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function positionChanges(before: string, after: string) {
  const expand = (placement: string) => placement.replaceAll("/", "").replace(/\d/g, digit => ".".repeat(Number(digit)));
  const previous = expand(before), current = expand(after);
  return [...current].flatMap((piece, index) => piece === previous[index] ? [] : [
    `${String.fromCharCode(97 + index % 8)}${8 - Math.floor(index / 8)}: ${previous[index] === "." ? "empty" : previous[index]} → ${piece === "." ? "empty" : piece}`,
  ]).join(", ");
}

type ActivityEntry = { id: number; time: string; message: string };

export function BoardRecorder({ ownerId, playerName }: { ownerId: string; playerName: string }) {
  const [draft, setDraft] = useState<RecordingDraft | null>(null);
  const draftRef = useRef<RecordingDraft | null>(null);
  const [message, setMessage] = useState("Connect your board to test whether it reports positions during King play.");
  const [storageError, setStorageError] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [listenOnly, setListenOnly] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const [position, setPosition] = useState<string | null>(null);
  const positionRef = useRef<string | null>(null);
  const calibratedOrder = useRef<boolean | null>(null);
  const [fresh, setFresh] = useState(false);
  const [firmware, setFirmware] = useState("");
  const [receivedPackets, setReceivedPackets] = useState(0);
  const [manualMove, setManualMove] = useState("");
  const [playedMoves, setPlayedMoves] = useState("");
  const [automatic, setAutomatic] = useState(true);
  const autoRef = useRef(true);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const connection = useRef<ChessLinkConnection | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const diagnostics = useRef<string[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const activityRef = useRef<ActivityEntry[]>([]);
  const activityId = useRef(0);
  const activityContainer = useRef<HTMLDivElement | null>(null);
  const [lastPacket, setLastPacket] = useState("");
  const lastDecodeError = useRef("");
  const key = `chess-coach:chesslink:${ownerId}`;

  const logActivity = useCallback((message: string) => {
    const entry = { id: ++activityId.current, time: new Date().toISOString(), message };
    activityRef.current = [...activityRef.current.slice(-99), entry];
    setActivity(activityRef.current);
  }, []);

  useEffect(() => {
    const container = activityContainer.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [activity]);

  function update(next: RecordingDraft) {
    draftRef.current = next; setDraft(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("Your browser could not preserve the draft. Download PGN before leaving this page."); }
  }
  function pause() {
    recordingRef.current = false; setRecording(false); clearTimeout(settle.current); setCandidate(null);
  }
  function accept(uci: string) {
    const current = draftRef.current;
    if (!current || current.finished || !recordingRef.current || !positionRef.current) {
      logActivity(`Move ${uci} not recorded: recording is inactive or the board position is unavailable.`); return;
    }
    const matched = matchPosition(current.moves, positionRef.current);
    if (matched.kind !== "move" || matched.uci !== uci) {
      logActivity(`Move ${uci} not recorded: the latest board position no longer matches it.`); return;
    }
    const next = { ...current, moves: [...current.moves, uci] };
    update(next); setCandidate(null); setMessage(`Recorded ${recordingChess(next.moves).history().at(-1)}.`);
    logActivity(`Recorded ${recordingChess(next.moves).history().at(-1)} (${uci}), half-move ${next.moves.length}.`);
  }

  useEffect(() => {
    const restore = setTimeout(() => { try {
      const stored = localStorage.getItem(key);
      const initial = stored ? readDraft(stored) : newDraft(playerName);
      draftRef.current = initial; setDraft(initial);
      if (stored) setMessage("Recovered your draft. Connect and synchronize before resuming.");
      if (stored) logActivity(`Recovered draft with ${initial.moves.length} half-moves. Recording is paused.`);
    } catch {
      setStorageError("The draft could not be read. Download the recovery data before discarding it.");
      // Keep the unreadable value available through the recovery download; never overwrite it automatically.
    } }, 0);
    const onVisibility = () => {
      if (document.hidden && recordingRef.current) {
        logActivity("Recording paused: browser tab became inactive.");
        recordingRef.current = false; setRecording(false); setCandidate(null); clearTimeout(settle.current);
        positionRef.current = null; setPosition(null); setFresh(false);
        setMessage("Recording paused while the tab was inactive. Synchronize and resume before playing.");
      }
    };
    // Notification-only boards may remain silent throughout the King's thinking time.
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearTimeout(restore); clearTimeout(settle.current); connection.current?.close(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [key, playerName, logActivity]);

  async function queryOnce(command: "V" | "S") {
    const link = connection.current;
    if (!link || recordingRef.current) return;
    setQuerying(true);
    logActivity(`Manual ${command === "V" ? "firmware" : "position"} query requested; check the King’s LED prompts afterward.`);
    try {
      await link.queryOnce(command);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Board query failed.");
    } finally { setQuerying(false); }
  }

  async function connect() {
    const access = browserBluetooth();
    if (!access || !window.isSecureContext) {
      setMessage("Use desktop Chrome with Bluetooth enabled, on HTTPS or localhost. This browser cannot connect here."); return;
    }
    pause(); setConnecting(true); setConnected(false); setFresh(false);
    setReceivedPackets(0); setFirmware(""); setLastPacket(""); lastDecodeError.current = "";
    logActivity("Connecting to ChessLink. Waiting for board data.");
    calibratedOrder.current = null;
    positionRef.current = null; setPosition(null);
    const link = new ChessLinkConnection(event => {
      if (event.kind === "version") { setFirmware(event.version); logActivity(`ChessLink firmware ${event.version} received.`); return; }
      setFresh(true);
      const current = draftRef.current;
      if (!current) return;
      // Some firmware reports from H1 toward A8 even with a normally placed board.
      // Calibrate against the full known position, never from physical orientation or color.
      let reverse = calibratedOrder.current ?? current.rotated;
      if (calibratedOrder.current === null && !recordingRef.current) {
        const expected = recordingChess(current.moves).fen().split(" ")[0];
        const forward = squaresToPlacement(event.squares);
        const backward = squaresToPlacement(event.squares, true);
        if (forward === expected || backward === expected) {
          reverse = backward === expected;
          calibratedOrder.current = reverse;
          logActivity(`Square order detected: ${reverse ? "reversed" : "forward"}. Board matches the recorded position.`);
          setMessage("Board synchronized. Click Start recording before playing.");
          if (reverse !== current.rotated) update({ ...current, rotated: reverse });
        }
      }
      const placement = squaresToPlacement(event.squares, reverse);
      const previous = positionRef.current;
      const changed = positionRef.current !== placement;
      positionRef.current = placement; setPosition(placement);
      if (changed) {
        logActivity(previous ? `Board changed — ${positionChanges(previous, placement)}.` : `Board position received: ${placement}.`);
        if (!recordingRef.current && !current.finished) {
          const observed = matchPosition(current.moves, placement);
          if (observed.kind === "move") logActivity(`Legal move ${observed.uci} detected while paused; it was not recorded. Synchronize or reconstruct before resuming.`);
          else if (observed.kind !== "same") logActivity("Reported position differs from the recording. Recording remains paused.");
        }
      }
      if (!changed || !recordingRef.current || current.finished) return;
      clearTimeout(settle.current); setCandidate(null);
      settle.current = setTimeout(() => {
        const active = draftRef.current;
        if (!active || !recordingRef.current || active.finished || document.hidden) return;
        const match = matchPosition(active.moves, placement);
        if (match.kind === "mismatch" && isIncompleteMove(active.moves, placement)) {
          logActivity("Move in progress: waiting for the destination press or remaining pieces. Recording stays active.");
          setMessage("Move in progress. Complete the move on the physical board; recording is still active.");
        } else if (match.kind === "move") {
          const preview = recordingChess([...active.moves, match.uci]).history().at(-1);
          logActivity(`Detected ${preview} (${match.uci}) — ${autoRef.current ? "accepting automatically" : "waiting for confirmation"}.`);
          setCandidate(match.uci);
          setMessage("Legal move detected. Confirm once you have completed moving all pieces.");
          if (autoRef.current) accept(match.uci);
        } else if (match.kind !== "same") {
          logActivity(match.kind === "takeback" ? `Earlier position detected at half-move ${match.ply}. Recording paused for takeback confirmation.` : "Stable position is not a legal next move. Recording paused for correction.");
          recordingRef.current = false; setRecording(false);
          setMessage(match.kind === "takeback" ? "Earlier position detected. Confirm the takeback, then resume." : "Position does not match a legal next move. Finish moving pieces, correct the board, or enter missing moves, then resume.");
        }
      }, 800);
    }, message => {
      logActivity(message);
      pause(); setConnected(false); setFresh(false); positionRef.current = null; setPosition(null); setMessage(message);
    }, diagnostic => {
      if (diagnostic.startsWith("RX ")) { setReceivedPackets(count => count + 1); setLastPacket(diagnostic); }
      else if (diagnostic.startsWith("Discarded") && diagnostic !== lastDecodeError.current) {
        lastDecodeError.current = diagnostic; logActivity(diagnostic);
      }
      diagnostics.current.push(`${new Date().toISOString()} ${diagnostic}`);
      if (diagnostics.current.length > 300) diagnostics.current.shift();
    });
    connection.current?.close(); connection.current = link;
    try {
      await link.connect(access, listenOnly);
      logActivity(listenOnly ? "Bluetooth connected in listen-only mode; no ChessLink commands sent." : "Bluetooth connected. Initial queries only; listening for position changes.");
      setConnected(true);
      const active = draftRef.current;
      setMessage(active && positionRef.current && matchPosition(active.moves, positionRef.current).kind === "same"
        ? "Board synchronized. Click Start recording before playing."
        : "Connected. Waiting for a matching board position. Keep the King in normal engine play for this test.");
    } catch (error) {
      logActivity("Bluetooth connection failed or pairing was cancelled.");
      setMessage(error instanceof DOMException && error.name === "NotFoundError" ? "Pairing cancelled or board not found. Power on ChessLink and close other board clients, then retry." : "Could not connect to ChessLink. Close Chessconnect and other board apps, check power/Bluetooth, and retry. Download diagnostics if it persists.");
    } finally { setConnecting(false); }
  }

  function start() {
    const current = draftRef.current;
    if (!current || current.finished || !connected || !fresh || !positionRef.current ||
        matchPosition(current.moves, positionRef.current).kind !== "same") return;
    recordingRef.current = true; setRecording(true); setMessage("Recording. Keep this tab active and move both sides’ pieces on the physical board.");
    logActivity("Recording started. Waiting for a changed board position.");
  }
  function finish() {
    if (!draft) return;
    pause(); connection.current?.close(); setConnected(false); setFresh(false);
    const chess = recordingChess(draft.moves);
    const result = chess.isCheckmate() ? chess.turn() === "w" ? "0-1" : "1-0" : chess.isStalemate() ? "1/2-1/2" : draft.result;
    update({ ...draft, finished: true, result });
    logActivity(`Recording finished with ${draft.moves.length} half-moves; result ${result}.`);
    setMessage("Recording finished. Confirm the result, then save or download your game.");
  }
  async function save() {
    if (!draft?.finished || !draft.moves.length || savingRef.current || savedId) return;
    const snapshot = { ...draft, savePgn: draft.savePgn ?? recordingPgn(draft) };
    update(snapshot); savingRef.current = true; setSaving(true);
    try {
      const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pgn: snapshot.savePgn, userColor: snapshot.color, recordingId: snapshot.id }) });
      const body = await response.json();
      if (!response.ok || typeof body.gameId !== "string") throw new Error(body.error?.message ?? "Could not save. Retry using this preserved recording.");
      setSavedId(body.gameId);
      try { localStorage.removeItem(key); } catch { setStorageError("Saved successfully, but the local draft could not be removed."); }
      setMessage("Game saved to My Games.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Your recording is preserved; retry."); }
    finally { savingRef.current = false; setSaving(false); }
  }
  function discard() {
    if (!window.confirm("Discard this recording and start a new game?")) return;
    pause(); connection.current?.close(); setConnected(false); setFresh(false); setPosition(null); positionRef.current = null;
    setSavedId(null); update(newDraft(playerName)); setMessage("New recording ready. Set up the initial position on the board.");
  }

  if (!draft) return <section className={shared.card}><p role="status">{storageError || "Loading recorder…"}</p>{storageError && <div className={styles.actions}><button className={shared.primary} onClick={() => { try { download(localStorage.getItem(key) ?? "", "chesslink-recovery.json", "application/json"); } catch { setStorageError("Browser storage is unavailable."); } }}>Download recovery data</button><button className={shared.primary} onClick={discard}>Discard and start new</button></div>}</section>;
  const chess = recordingChess(draft.moves);
  const match = position ? matchPosition(draft.moves, position) : null;
  const expected = chess.fen().split(" ")[0];
  const startReason = connecting ? "Waiting for Bluetooth connection…" : !connected ? "Connect the board first."
    : !position ? receivedPackets ? "Bluetooth data arrived, but no supported board position was decoded. Download diagnostics so we can check the board's message format."
      : "Bluetooth is connected, but the board has not sent a position. Start recording needs a position matching the board shown. Try Query position once below; this may interrupt the King’s LED prompts."
    : !fresh ? "The last board position is out of date. Wait for a new report or reconnect."
    : match?.kind !== "same" ? "The reported board position differs from the recorded position. Restore the position shown on screen, check ChessLink square order, or use the correction controls."
    : "Board synchronized. You can start recording.";
  const diagnosticReport = () => [
    "Chess Coach — ChessLink connection diagnostics",
    `Listen only: ${listenOnly}`,
    `Connected: ${connected}; firmware: ${firmware || "unknown"}; received packets: ${receivedPackets}`,
    `Recording: ${recording}; reversed ChessLink square order: ${draft.rotated}; recorded plies: ${draft.moves.length}`,
    `Expected placement: ${expected}`,
    `Reported placement: ${position ?? "none"}; fresh: ${fresh}`,
    `Recording gate: ${startReason}`, "", "Activity:",
    ...activityRef.current.map(entry => `${entry.time} ${entry.message}`), "", "Transport:", ...diagnostics.current,
  ].join("\n");
  const locked = recording || draft.moves.length > 0 || draft.finished || connecting;
  return <div className={styles.layout}>
    <section className={shared.card} aria-label="Recorded game">
      <ReplayBoard fen={chess.fen()} userColor={draft.color} lastMove={draft.moves.at(-1)} positionLabel="Recorded board" />
      <p className={shared.hint}>{draft.moves.length} half-moves recorded · {recording ? "Recording" : draft.finished ? "Finished" : "Paused"}</p>
      <ol className={styles.moves} aria-label="Recorded moves">{chess.history().map((san, index) => <li key={index}>{index % 2 === 0 ? `${index / 2 + 1}. ` : ""}{san}</li>)}</ol>
    </section>
    <div className={styles.stack}>
      <section className={shared.card}>
        <h2 className={shared.cardTitle}>Millennium ChessLink</h2>
        <p className={shared.hint}>Experimental: Bluetooth recording while the built-in King plays still needs testing on your board. Start in normal King play. If positions arrive only in CLink mode, simultaneous recording may be unsupported.</p>
        <p className={shared.hint}>Close Chessconnect and other board apps first. Use desktop Chrome on HTTPS or localhost. Start recording before playing and keep this tab active. Missing moves can be recovered by entering the move sequence you know.</p>
        <label><input type="checkbox" checked={listenOnly} disabled={connected || connecting} onChange={event => setListenOnly(event.target.checked)} /> Listen only (preserve King LED prompts)</label>
        {!listenOnly && <p className={shared.hint}>Initial firmware and position queries may interrupt the King’s LED prompts. Use this mode only for connection troubleshooting.</p>}
        {listenOnly && <p className={shared.hint}>No ChessLink commands are sent. Firmware may remain unknown. If no position arrives, press an occupied square without moving its piece. Recording requires a matching position.</p>}
        <p>{connected ? "Connected" : "Disconnected"}{firmware ? ` · Firmware ${firmware}` : ""} · {fresh ? match?.kind === "same" ? "Synchronized" : "Board differs" : "Waiting for position"}</p>
        <div className={styles.actions}>
          <button className={shared.primary} onClick={connect} disabled={connecting || querying || saving || draft.finished}>{connecting ? "Connecting…" : connected ? "Reconnect" : "Connect board"}</button>
          {connected && <button className={styles.secondary} onClick={() => { pause(); connection.current?.close(); setConnected(false); setFresh(false); setMessage("Disconnected. Your draft is preserved."); }}>Disconnect</button>}
          <button className={styles.secondary} onClick={() => download(diagnosticReport(), "chesslink-diagnostics.txt", "text/plain")}>Download diagnostics</button>
        </div>
        {connected && listenOnly && !recording && <details open={!position || undefined}>
          <summary>Troubleshoot missing move updates</summary>
          <p className={shared.hint}>Try Query firmware once first, then press a square and check for incoming positions. If none arrive, try Query position once. These send commands even in Listen only mode and may interrupt LED prompts. Restart the King between tests to compare them independently.</p>
          <div className={styles.actions}>
            <button className={styles.secondary} disabled={querying} onClick={() => queryOnce("V")}>Query firmware once</button>
            <button className={styles.secondary} disabled={querying} onClick={() => queryOnce("S")}>Query position once</button>
          </div>
        </details>}
        <p role="status" className={shared.notice}>{message}</p>
        {!draft.finished && !recording && <p id="recording-gate" className={shared.notice}>{startReason}</p>}
        {!draft.finished && <div className={styles.actions}>
          {!recording && <button className={shared.primary} aria-describedby="recording-gate" disabled={!connected || !fresh || match?.kind !== "same"} onClick={start}>{draft.moves.length ? "Resume recording" : "Start recording"}</button>}
          {recording && <button className={styles.secondary} onClick={() => { pause(); logActivity("Recording paused by you."); }}>Pause</button>}
          {candidate && recording && <button className={shared.primary} onClick={() => accept(candidate)}>Confirm {candidate}</button>}
        </div>}
        {!draft.finished && <p className={shared.hint}>{recording ? automatic ? "Recording is active. Completed legal moves are saved automatically." : "Recording is active. Confirm each detected move here before playing the next move." : "Connected does not mean recording. Click Start recording before making your first move, or recover moves already played below."}</p>}
        {position && match?.kind !== "same" && <details><summary>Compare reported and recorded positions</summary><p className={shared.hint}>These placements help diagnose square order or missing moves.</p><div className={styles.placement}>Recorded: {expected}<br />Reported: {position}</div></details>}
        {storageError && <p role="alert" className={shared.error}>{storageError}</p>}
      </section>
      <section className={shared.card} aria-labelledby="board-activity-title">
        <h2 id="board-activity-title" className={shared.cardTitle}>Live board activity</h2>
        <p className={shared.hint}>Shows position changes even before recording starts. Repeated identical positions are omitted. {receivedPackets} Bluetooth packets received.</p>
        <div ref={activityContainer} className={styles.activity} role="log" aria-label="Board activity" aria-live="polite" aria-relevant="additions">
          {activity.length ? activity.map(entry => <div key={entry.id} className={styles.activityEntry}><time dateTime={entry.time}>{new Date(entry.time).toLocaleTimeString()}</time><span>{entry.message}</span></div>) : <p className={shared.hint}>Connect the board, then press the departure and destination squares to see what arrives.</p>}
        </div>
        <div className={styles.actions}><button className={styles.secondary} disabled={!activity.length} onClick={() => { activityRef.current = []; setActivity([]); }}>Clear activity</button><button className={styles.secondary} onClick={() => download(diagnosticReport(), "chesslink-diagnostics.txt", "text/plain")}>Download activity and diagnostics</button></div>
        <details><summary>Latest raw Bluetooth packet</summary><div className={styles.placement}>{lastPacket || "No Bluetooth packet received yet."}</div></details>
      </section>
      <section className={`${shared.card} ${styles.stack}`}>
        <h2 className={shared.cardTitle}>Game details</h2>
        <div><label htmlFor="recorder-color" className={shared.label}>Your color</label><select id="recorder-color" className={shared.input} value={draft.color} disabled={locked} onChange={event => update({ ...draft, color: event.target.value as RecordingDraft["color"] })}><option value="WHITE">White</option><option value="BLACK">Black</option></select></div>
        <label className={shared.label}>Your name<input className={shared.input} maxLength={100} value={draft.player} disabled={!!draft.savePgn || saving || !!savedId} onChange={event => update({ ...draft, player: event.target.value })} /></label>
        <label className={shared.label}>Played on<input type="date" className={shared.input} value={draft.date} disabled={!!draft.savePgn || saving || !!savedId} onChange={event => { if (event.target.value) update({ ...draft, date: event.target.value }); }} /></label>
        <label className={styles.checkbox}><input type="checkbox" checked={draft.rotated} disabled={locked} onChange={event => { calibratedOrder.current = event.target.checked; update({ ...draft, rotated: event.target.checked }); positionRef.current = null; setPosition(null); }} /> Reverse ChessLink square order</label>
        <p className={shared.hint}>Square order is detected automatically when the board matches the recorded position. This setting describes incoming data, not how your board is physically placed.</p>
        <label className={styles.checkbox}><input type="checkbox" checked={automatic} disabled={recording || draft.finished} onChange={event => { setAutomatic(event.target.checked); autoRef.current = event.target.checked; }} /> Automatically accept stable legal positions</label>
        <p className={shared.hint}>Automatic recording is enabled by default. Completed legal moves sync after 800 ms. Turn this off if you want to confirm each move while troubleshooting; move the king first when castling.</p>
        <div className={styles.actions}>
          {!draft.finished && <button className={styles.secondary} onClick={finish} disabled={!draft.moves.length}>Finish game</button>}
        </div>
        {!recording && !draft.finished && connected && fresh && match?.kind !== "same" && <form onSubmit={event => {
          event.preventDefault();
          try {
            if (!positionRef.current) throw new Error("Wait for a fresh board position before recovering moves.");
            const moves = reconstructMoves(playedMoves, positionRef.current);
            if (draft.moves.some((move, index) => moves[index] !== move)) throw new Error("Move text must include the moves already recorded, in the same order.");
            update({ ...draft, moves }); setPlayedMoves("");
            logActivity(`Recovered ${moves.length} half-moves from your supplied move text; board synchronized.`);
            setMessage("Moves recovered. Click Resume recording before continuing the game.");
          } catch (error) { setMessage(error instanceof Error ? error.message : "Could not recover moves."); }
        }}><label className={shared.label}>Moves already played<input className={shared.input} value={playedMoves} maxLength={100_000} onChange={event => setPlayedMoves(event.target.value)} placeholder="1. d4 e6 2. e4 d5" /></label><p className={shared.hint}>Enter the complete move sequence from the start. Recovery succeeds only if the moves reach the current physical board position.</p><button className={styles.secondary} type="submit">Recover played moves</button></form>}
        {!recording && !draft.finished && <details><summary>Correct or reconstruct moves</summary><p className={shared.hint}>Use this only to reconcile a takeback or moves missed while disconnected. Resume when the physical board matches.</p>
          {match?.kind === "takeback" && fresh && <button className={styles.secondary} onClick={() => { update({ ...draft, moves: draft.moves.slice(0, match.ply) }); setMessage("Takeback confirmed. Check the board and resume."); }}>Confirm takeback to half-move {match.ply}</button>}
          <form className={styles.actions} onSubmit={event => { event.preventDefault(); try { const next = { ...draft, moves: [...draft.moves, manualMove.trim().toLowerCase()] }; recordingChess(next.moves); update(next); setManualMove(""); setMessage("Manual correction recorded. Synchronize the board before resuming."); } catch { setMessage("Enter a legal coordinate move such as e2e4 or a7a8n."); } }}><label className={shared.label}>Missing move<input className={shared.input} value={manualMove} onChange={event => setManualMove(event.target.value)} maxLength={5} placeholder="e2e4" /></label><button className={styles.secondary} type="submit">Add move</button></form>
          <button className={styles.secondary} disabled={!draft.moves.length} onClick={() => { update({ ...draft, moves: draft.moves.slice(0, -1) }); setMessage("Last move removed. Synchronize the board before resuming."); }}>Undo last recorded move</button>
        </details>}
        {draft.finished && <><div><label htmlFor="recorder-result" className={shared.label}>Result</label><select id="recorder-result" className={shared.input} value={draft.result} disabled={!!draft.savePgn || saving || !!savedId} onChange={event => update({ ...draft, result: event.target.value as RecordingDraft["result"] })}><option value="*">Unfinished / unknown</option><option value="1-0">White wins</option><option value="0-1">Black wins</option><option value="1/2-1/2">Draw</option></select></div><p className={shared.hint}>Confirm resignation, draw or clock loss yourself. Once saving starts, the snapshot is fixed so retries cannot create another game.</p><button className={shared.primary} disabled={saving || !!savedId || !draft.moves.length} onClick={save}>{saving ? "Saving…" : savedId ? "Saved" : "Save to My Games"}</button>{savedId && <Link className={shared.link} href={`/games/${savedId}?analyze=1`}>Review and analyze game →</Link>}</>}
        <div className={styles.actions}><button className={styles.secondary} disabled={!draft.moves.length} onClick={() => download(draft.savePgn ?? recordingPgn(draft), "king-performance.pgn", "application/x-chess-pgn")}>Download PGN</button><button className={styles.secondary} disabled={saving || connecting} onClick={discard}>{savedId ? "New recording" : "Discard recording"}</button></div>
      </section>
    </div>
  </div>;
}
