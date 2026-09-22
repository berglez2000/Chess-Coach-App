import type { NormalizedEvaluation } from "@/types/analysis";
import type { ReviewAnalysis } from "@/lib/analysis/review";

export function formatEvaluation(evaluation: NormalizedEvaluation | null | undefined): string {
  if (!evaluation) return "Not available";
  const { score } = evaluation;
  const qualifier = score.bound === "lower" ? "Lower bound: " : score.bound === "upper" ? "Upper bound: " : "";
  if (score.kind === "mate") return `${qualifier}${score.winner === "WHITE" ? "White" : "Black"} ${score.value === 0 ? "has delivered checkmate" : `mates in ${Math.abs(score.value)}`}`;
  return `${qualifier}${score.value > 0 ? "+" : ""}${(score.value / 100).toFixed(2)} pawns`;
}

export function EnginePanel({ analysis, initial = false }: { analysis: ReviewAnalysis | null | undefined; initial?: boolean }) {
  const current = initial ? analysis?.before : analysis?.after;
  return <section aria-labelledby="engine-panel-heading" className="mt-6 rounded-lg border border-[#20382e]/20 bg-white p-5">
    <h3 id="engine-panel-heading" className="text-lg font-semibold">Engine analysis</h3>
    <p className="mt-2 text-sm">Scores are from White’s perspective. Positive pawn scores favor White.</p>
    <dl className="mt-4 space-y-2">
      <div><dt className="font-semibold">{initial ? "Initial-position evaluation" : "Current-position evaluation (after move)"}</dt><dd>{formatEvaluation(current)}{current ? ` · Depth ${current.depth}` : ""}</dd></div>
      {!initial && <div><dt className="font-semibold">Before-move evaluation</dt><dd>{formatEvaluation(analysis?.before)}</dd></div>}
      {!initial && analysis && <>
        <div><dt className="font-semibold">Move classification</dt><dd>{analysis.quality === "unknown" ? "Unclassified — insufficient or conflicting evidence" : analysis.quality}</dd></div>
        <div><dt className="font-semibold">Moving player’s loss</dt><dd>{analysis.cpLoss === null ? "Not measured in centipawns" : `${analysis.cpLoss} cp`}</dd></div>
      </>}
    </dl>
    {analysis ? <>
      {!initial && <p className="mt-3 text-sm">Assessment note: {analysis.reason.replaceAll("_", " ")}.</p>}
      <p className="mt-4"><strong>Engine choice {initial ? "from the initial position" : "before the played move"}:</strong> {analysis.bestMoveSan ?? "Not available"}</p>
      <p className="mt-2"><strong>Suggested line {initial ? "from the initial position" : "before the played move"}:</strong> {analysis.pvSan.length ? analysis.pvSan.slice(0, 8).join(" ") + (analysis.pvSan.length > 8 ? " …" : "") : "Not available"}</p>
      <p className="mt-3 text-sm text-[#465c50]">Finite-depth engine estimate; classifications are heuristic. Saved {analysis.analyzedAt.slice(0, 10)}.</p>
    </> : <p className="mt-4">No saved engine analysis for this position. Use the analysis controls above to analyze or retry the game.</p>}
  </section>;
}
