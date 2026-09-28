import { PROVIDERS } from "@/lib/coaching/providers";
import type { GameCoachingSummary, ReviewGame, AnalysisStatus } from "@/types/saved-game";

function ClassificationDot({ classification }: { classification: string }) {
  const colors: Record<string, string> = {
    blunder: "bg-red-500",
    mistake: "bg-orange-400",
    inaccuracy: "bg-yellow-400",
    normal: "bg-[#20382e]/30",
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[classification] ?? "bg-gray-300"}`} aria-hidden="true" />;
}

export function CoachingSummaryPanel({ coaching, moves, status, onSelectPly }: {
  coaching: GameCoachingSummary | null | undefined;
  moves: ReviewGame["moves"];
  status: AnalysisStatus;
  onSelectPly: (ply: number) => void;
}) {
  const positiveMoves = moves.filter(m => m.positiveHighlight);
  const annotatedMoves = moves.filter(m => m.coaching);

  if (!coaching) {
    if (status === "COMPLETED") {
      return (
        <section aria-labelledby="coaching-summary-heading" className="mt-8 rounded-lg border border-[#20382e]/20 bg-white p-5">
          <h3 id="coaching-summary-heading" className="text-lg font-semibold">Coaching summary</h3>
          <p className="mt-4 text-sm">Coaching summary unavailable. Saved moves and engine results remain available below.</p>
        </section>
      );
    }
    if (status === "FAILED") {
      return (
        <section aria-labelledby="coaching-summary-heading" className="mt-8 rounded-lg border border-[#20382e]/20 bg-white p-5">
          <h3 id="coaching-summary-heading" className="text-lg font-semibold">Coaching summary</h3>
          <p className="mt-4 text-sm">Coaching could not be generated. Use the retry button above.</p>
        </section>
      );
    }
    return null;
  }

  return (
    <section aria-labelledby="coaching-summary-heading" className="mt-8 rounded-lg border border-[#20382e]/20 bg-white p-5">
      <h3 id="coaching-summary-heading" className="text-lg font-semibold">Coaching summary</h3>
      <p className="mt-2 text-sm">Coached by {PROVIDERS[coaching.provider].label} · {coaching.model}</p>
      <p className="mt-3 text-sm">{coaching.summary}</p>

      {coaching.strengths.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold text-sm text-[#20382e]">Strengths</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
            {coaching.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {coaching.improvements.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold text-sm text-[#20382e]">To improve</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
            {coaching.improvements.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <h4 className="text-sm font-semibold">Positive highlights</h4>
        {positiveMoves.length > 0 ? (
          <nav aria-label="Positive highlights" className="mt-2 space-y-3">
            {positiveMoves.map(move => (
              <div key={move.ply}>
                <button type="button" onClick={() => onSelectPly(move.ply)}
                  className="rounded-lg border border-[#20382e]/30 px-3 py-1.5 text-sm font-medium hover:bg-[#20382e]/5 focus-visible:outline-2 focus-visible:outline-offset-2">
                  {move.moveNumber}{move.color === "WHITE" ? "." : "…"} {move.san} · Positive highlight
                </button>
                {move.coaching ? <>
                  {move.coaching.headline && <p className="mt-2 text-sm font-semibold">{move.coaching.headline}</p>}
                  <p className="mt-1 text-sm">{move.coaching.explanation}</p>
                  <p className="mt-1 text-sm"><span className="font-semibold">Lesson: </span>{move.coaching.lesson}</p>
                </> : <p className="mt-2 text-sm">Coaching for this highlight is unavailable.</p>}
              </div>
            ))}
          </nav>
        ) : <p className="mt-2 text-sm">No supported positive highlights were selected for this game.</p>}
      </div>

      {annotatedMoves.length > 0 && (
        <div className="mt-5">
          <p className="font-semibold text-sm text-[#20382e]">Annotated moments</p>
          <nav aria-label="Annotated moments" className="mt-2 flex flex-wrap gap-2">
            {annotatedMoves.map(move => (
              <button
                key={move.ply}
                type="button"
                onClick={() => onSelectPly(move.ply)}
                className="flex items-center gap-1.5 rounded-lg border border-[#20382e]/30 px-3 py-1.5 text-sm font-medium hover:bg-[#20382e]/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label={`Go to move ${move.moveNumber}${move.color === "WHITE" ? "." : "…"} ${move.san} — ${move.coaching!.classification}`}
              >
                <ClassificationDot classification={move.coaching!.classification} />
                {move.moveNumber}{move.color === "WHITE" ? "." : "…"} {move.san}
              </button>
            ))}
          </nav>
        </div>
      )}

      <p className="mt-4 text-xs text-[#465c50]">Coach model: {coaching.model}</p>
    </section>
  );
}
