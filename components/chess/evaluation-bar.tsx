import type { NormalizedEvaluation } from "@/types/analysis";
import { formatEvaluation } from "@/components/games/engine-panel";

export function whitePercentage(evaluation: NormalizedEvaluation | null | undefined): number {
  if (!evaluation) return 50;
  if (evaluation.score.kind === "mate") return evaluation.score.winner === "WHITE" ? 100 : 0;
  return 50 + 50 * Math.tanh(evaluation.score.value / 600);
}

export function EvaluationBar({ evaluation, whiteBottom }: {
  evaluation: NormalizedEvaluation | null | undefined;
  whiteBottom: boolean;
}) {
  const score = evaluation?.score;
  const bound = score?.bound === "lower" ? "≥" : score?.bound === "upper" ? "≤" : "";
  const label = !score ? "—" : score.kind === "mate"
    ? `${score.winner === "WHITE" ? "+" : "−"}M${Math.abs(score.value)}`
    : `${score.value > 0 ? "+" : ""}${(score.value / 100).toFixed(1)}`;

  return <div role="img" aria-label={`Stockfish evaluation: ${formatEvaluation(evaluation)}`}
    title={formatEvaluation(evaluation)}
    className="relative w-10 shrink-0 overflow-hidden rounded border border-[#20382e]/30 bg-[#292724]">
    <div data-testid="evaluation-white" className="absolute inset-x-0 bg-[#faf7ed] transition-[height] duration-300 ease-in-out motion-reduce:transition-none"
      style={{ height: `${whitePercentage(evaluation)}%`, ...(whiteBottom ? { bottom: 0 } : { top: 0 }) }} />
    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-[#f6f5f0] py-1 text-center text-[10px] font-bold tabular-nums text-[#20382e]">
      {bound}{label}
    </span>
  </div>;
}
