"use client";
import { useState } from "react";
import { EvaluationBar } from "@/components/chess/evaluation-bar";
import { SEARCH_PRESETS, scoreLabel, type AnalysisPosition, type SearchPreset } from "@/lib/position-analysis/contract";
import { usePositionAnalysis } from "./use-position-analysis";
import styles from "./analysis.module.css";

/** Shared opt-in controls. The host decides whether to offer applying a candidate. */
export function PositionAnalysisPanel({ position, whiteBottom = true, onPlay }: {
  position: AnalysisPosition; whiteBottom?: boolean; onPlay?: (moves: string[]) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [preset, setPreset] = useState<SearchPreset>("standard");
  const [revision, setRevision] = useState(0);
  const { result, status, error } = usePositionAnalysis(position, preset, enabled, revision);
  const searching = status === "searching";
  return <section aria-label="Deeper position analysis" className={styles.panel}>
    <div className={styles.actions}><h2>Position analysis</h2><span className={styles.badge}>Stockfish · Top 3</span></div>
    <p className={styles.muted}>White perspective: positive scores favor White; negative scores favor Black. M indicates mate.</p>
    <div className={styles.actions}>
      <label className={styles.limit}>Thinking time<select aria-label="Analysis thinking time" value={preset} onChange={event => setPreset(event.target.value as SearchPreset)}>{Object.entries(SEARCH_PRESETS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      <button type="button" className={styles.primary} onClick={() => { if (searching) setEnabled(false); else { setEnabled(true); setRevision(value => value + 1); } }}>{searching ? "Stop analysis" : error ? "Retry analysis" : "Analyze position"}</button>
      {enabled && !searching && <button type="button" className={styles.button} onClick={() => setEnabled(false)}>Disable analysis</button>}
    </div>
    <p role="status" aria-label="Analysis status" className={styles.muted}>{searching ? `Searching · up to ${SEARCH_PRESETS[preset].milliseconds / 1000} seconds per position${result?.evaluation ? ` · Depth ${result.evaluation.depth} · Partial results` : ""}` : status === "complete" ? `${result?.terminal ? "Position ended" : "Search complete"}${result?.evaluation && !result.terminal ? ` · Depth ${result.evaluation.depth}` : ""}${enabled ? " · Updates when the position changes" : ""}` : status === "stopped" ? "Analysis stopped · Partial results" : error ? "Search failed" : "Enable analysis to see candidates for this position."}</p>
    {error && <p role="alert" className={styles.error}>{error}{result && " Partial results are retained."}</p>}
    {result && <div className={styles.results}>
      <EvaluationBar evaluation={result.evaluation} whiteBottom={whiteBottom} />
      <div className={styles.lines}>
        {result.terminal && <p className={styles.terminal}>{result.terminal === "checkmate" ? `${result.evaluation?.score.kind === "mate" && result.evaluation.score.winner === "WHITE" ? "White" : "Black"} delivered checkmate.` : result.terminal === "stalemate" ? "Stalemate · Draw" : "Draw · Position ended"}</p>}
        {result.candidates.map(candidate => <div className={styles.candidate} key={candidate.rank}>
          <div className={styles.actions}><strong>{candidate.rank}. {candidate.moves[0].san}</strong><span className={styles.score}>{scoreLabel(candidate.evaluation)}</span><span className={styles.muted}>Depth {candidate.evaluation.depth}</span></div>
          <p className={styles.continuation}>{candidate.moves.map(move => move.label).join(" ")}</p>
          {onPlay && <button type="button" className={styles.button} onClick={() => onPlay([candidate.moves[0].uci])}>Try {candidate.moves[0].san}</button>}
        </div>)}
        {!result.terminal && result.candidates.length < 3 && <p className={styles.muted}>{searching ? "Candidates are still being searched." : `${result.candidates.length} candidate${result.candidates.length === 1 ? "" : "s"} available at this search limit.`}</p>}
      </div>
    </div>}
    <p className={styles.muted}>Finite search estimates. Continuations show up to 24 half-moves.</p>
  </section>;
}
