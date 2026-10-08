"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_POSITION } from "chess.js";
import { EMPTY_OPENING, exportPgn, importPgn, position, validateContent, type OpeningContent, type OpeningLine } from "@/lib/openings/content";
import type { OpeningDto } from "@/lib/openings/repository";
import { useMoveSound } from "@/components/chess/use-move-sound";
import { PositionAnalysisPanel } from "@/components/analysis/position-panel";
import { MoveBoard } from "./move-board";
import styles from "./openings.module.css";
export function OpeningEditor({ initial }: { initial?: OpeningDto }) {
  const router = useRouter();
  const sound = useMoveSound();
  const [content, setContent] = useState<OpeningContent>(initial ? { name: initial.name, description: initial.description, color: initial.color, startFen: initial.startFen, lines: initial.lines } : EMPTY_OPENING);
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [saved, setSaved] = useState(JSON.stringify(content));
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [moves, setMoves] = useState<string[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [fenInput, setFenInput] = useState(content.startFen);
  const [pgn, setPgn] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(content) !== saved;
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function accept(next: OpeningContent) {
    try { validateContent({ ...next, name: next.name.trim() || "Untitled opening" }); setContent(next); setError(""); setNotice(""); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid variation."); return false; }
  }
  function play(uci: string) {
    try {
      const chess = position(content.startFen, moves);
      if (chess.isGameOver()) throw new Error("This position has ended. Go back to branch earlier.");
      const nextMoves = [...moves, chess.move(uci).lan];
      const containing = content.lines.findIndex(line => nextMoves.every((move, i) => line.moves[i] === move));
      if (containing >= 0) { setMoves(nextMoves); setLineIndex(containing); setError(""); return true; }
      const leaf = content.lines.findIndex(line => line.moves.length === moves.length && moves.every((move, i) => line.moves[i] === move));
      const lines = [...content.lines];
      let selected: number;
      if (leaf >= 0) { lines[leaf] = { ...lines[leaf], moves: nextMoves }; selected = leaf; }
      else { selected = lines.length; lines.push({ name: `Variation ${lines.length + 1}`, moves: nextMoves }); }
      if (!accept({ ...content, lines })) return false;
      setLineIndex(selected); setMoves(nextMoves); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Illegal move."); return false; }
  }
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const checked = validateContent(content);
      const response = await fetch(initial ? `/api/openings/${initial.id}` : "/api/openings", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initial ? { revision, content: checked } : checked) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Could not save your opening.");
      if (!initial) { router.push(`/openings/${data.opening.id}`); router.refresh(); return; }
      setRevision(data.opening.revision); setContent(checked); setSaved(JSON.stringify(checked)); setNotice("Opening saved."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your opening."); }
    finally { setBusy(false); }
  }
  function mergeImported(incoming: OpeningLine[]) {
    const merged = [...content.lines];
    for (const line of incoming) {
      if (!merged.some(existing => existing.moves.join(" ") === line.moves.join(" "))) merged.push(line);
    }
    if (accept({ ...content, lines: merged })) {
      setNotice(`Imported ${merged.length - content.lines.length} variations. Save opening to keep them.`);
      setMoves([]); setLineIndex(0);
    }
  }
  async function importUrl() {
    setImporting(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/openings/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: sourceUrl, startFen: content.startFen }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "URL import failed.");
      mergeImported(data.lines);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "URL import failed."); }
    finally { setImporting(false); }
  }
  const chess = position(content.startFen, moves);
  const activeLine = content.lines[lineIndex];
  function navigate(next: string[]) { setMoves(next); setError(""); }
  return <div className={styles.stack}>
    <div className={styles.actions}><button className={styles.primary} disabled={busy || importing} onClick={save}>{busy ? "Saving…" : "Save opening"}</button>{initial && <Link className={styles.button} href={`/openings/${initial.id}`}>Opening overview</Link>}<span className={styles.muted}>{dirty ? "Unsaved changes" : initial ? "All changes saved" : "New opening"}</span></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.status}>{notice}</p>}
    <fieldset disabled={busy || importing} className={styles.stack}>
      <div className={styles.card}>
        <label className={styles.field}>Opening name<input value={content.name} maxLength={200} onChange={event => setContent({ ...content, name: event.target.value })} /></label>
        <label className={styles.field}>Description<textarea value={content.description} maxLength={20000} onChange={event => setContent({ ...content, description: event.target.value })} /></label>
        <label className={styles.field}>Practice color<select value={content.color} onChange={event => setContent({ ...content, color: event.target.value as OpeningContent["color"] })}><option value="WHITE">White</option><option value="BLACK">Black</option></select></label>
        <details><summary>Starting position</summary><label className={styles.field}>Starting FEN<input value={fenInput} onChange={event => setFenInput(event.target.value)} /></label><p className={styles.muted}>Applying a different starting position clears the current variations. Save or export them first.</p><div className={styles.actions}><button type="button" className={styles.button} onClick={() => { try { const fen = position(fenInput).fen(); if (fen !== content.startFen) { if (accept({ ...content, startFen: fen, lines: [] })) { setMoves([]); setLineIndex(0); setBoardFlipped(false); } } } catch { setError("Enter a valid FEN with both kings."); } }}>Apply starting position</button><button type="button" className={styles.button} onClick={() => setFenInput(DEFAULT_POSITION)}>Use normal starting FEN</button></div></details>
      </div>
      <div className={styles.layout}>
        <div className={`${styles.card} ${styles.boardCard}`}><h2>Variation board</h2><MoveBoard key={content.startFen} content={content} moves={moves} onPlay={play} disabled={busy} onFlip={setBoardFlipped} sound={sound} />
          <div className={styles.actions}><button type="button" className={styles.button} onClick={() => navigate([])}>Start</button><button type="button" className={styles.button} disabled={!moves.length} onClick={() => navigate(moves.slice(0, -1))}>Previous</button><button type="button" className={styles.button} disabled={!activeLine || moves.length >= activeLine.moves.length} onClick={() => navigate(activeLine.moves.slice(0, moves.length + 1))}>Next</button><button type="button" className={styles.button} disabled={!activeLine} onClick={() => navigate(activeLine.moves)}>End</button></div>
          <p className={styles.muted}>Current line: {chess.history().join(" · ") || "Starting position"}</p>
        </div>
        <div className={styles.stack}><PositionAnalysisPanel position={{ startFen: content.startFen, moves }} whiteBottom={(content.color === "WHITE") !== boardFlipped} onPlay={busy || importing ? undefined : line => { const board = position(content.startFen, moves); if (play(line[0])) { const move = board.move(line[0]); sound.play(move.san, board.isGameOver()); } }} /><div className={styles.card}><h2>Variations ({content.lines.length})</h2><p className={styles.muted}>Play moves to extend a line. Select an earlier move and play a different move to create a branch. Aim for 20–30 variations; up to 100 are supported.</p>
          {!content.lines.length && <p className={styles.status}>Play your first move or import a PGN to begin.</p>}
          {content.lines.map((line, index) => {
            const history = position(content.startFen, line.moves).history({ verbose: true });
            return <div className={styles.line} key={index}>
              <label className={styles.field}>Variation {index + 1} name<input maxLength={120} value={line.name} onChange={event => setContent({ ...content, lines: content.lines.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
              <div className={styles.moves}>{history.map((move, ply) => <button type="button" key={ply} aria-label={`Variation ${index + 1}, move ${ply + 1}: ${move.san}`} aria-pressed={lineIndex === index && moves.length === ply + 1} className={`${styles.move} ${lineIndex === index && moves.length === ply + 1 ? styles.selected : ""}`} onClick={() => { setLineIndex(index); navigate(line.moves.slice(0, ply + 1)); }}>{move.before.split(" ")[5]}{move.color === "w" ? "." : "…"} {move.san}</button>)}</div>
              <div className={styles.actions}><button type="button" className={styles.button} onClick={() => { setLineIndex(index); navigate(line.moves); }}>View line</button><button type="button" className={styles.button} onClick={() => { setContent({ ...content, lines: content.lines.filter((_, i) => i !== index) }); setMoves([]); setLineIndex(0); }}>Remove variation {index + 1}</button></div>
            </div>;
          })}
        </div></div>
      </div>
      <div className={styles.card}><h2>Import variations from URL</h2>
        <p className={styles.muted}>Paste a public Lichess study URL to import every chapter and PGN branch, or a raw GitHub / Gist PGN URL. Existing variations are kept and duplicates skipped. Up to 100 variations and 250 KB.</p>
        <label className={styles.field}>Source URL<input type="url" value={sourceUrl} maxLength={2048} placeholder="https://lichess.org/study/…" onChange={event => setSourceUrl(event.target.value)} /></label>
        <button type="button" className={styles.button} disabled={!sourceUrl.trim() || importing} onClick={importUrl}>{importing ? "Importing…" : "Import from URL"}</button>
      </div>
      <div className={styles.card}><h2>PGN import / export</h2><p className={styles.muted}>Import mainlines and nested PGN branches. Import adds variations; existing move sequences are kept once. Export saves each authored line as a separate PGN game.</p>
        <label className={styles.field}>PGN<textarea value={pgn} onChange={event => setPgn(event.target.value)} maxLength={250000} /></label>
        <div className={styles.actions}><button type="button" className={styles.button} onClick={() => { try { mergeImported(importPgn(pgn, content.startFen)); } catch (cause) { setError(cause instanceof Error ? cause.message : "PGN import failed."); } }}>Import PGN</button>
        <button type="button" className={styles.button} disabled={!content.lines.length} onClick={() => { setPgn(exportPgn(content)); setNotice("Exported PGN is in the text field. Copy it or download it."); }}>Export to text</button>
        <button type="button" className={styles.button} disabled={!content.lines.length} onClick={() => { const url = URL.createObjectURL(new Blob([exportPgn(content)], { type: "application/x-chess-pgn" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "opening.pgn"; anchor.click(); URL.revokeObjectURL(url); }}>Download PGN</button></div>
      </div>
    </fieldset>
  </div>;
}
