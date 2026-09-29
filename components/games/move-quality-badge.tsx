import type { MoveQuality } from "@/types/analysis";

const badges = {
  normal: { symbol: "✓", label: "Okay", color: "bg-emerald-100 text-emerald-800" },
  inaccuracy: { symbol: "?!", label: "Inaccuracy", color: "bg-yellow-100 text-yellow-800" },
  mistake: { symbol: "?", label: "Mistake", color: "bg-orange-100 text-orange-800" },
  blunder: { symbol: "??", label: "Blunder", color: "bg-red-100 text-red-800" },
  unknown: { symbol: "—", label: "Unclassified", color: "bg-slate-100 text-slate-600" },
  pending: { symbol: "·", label: "Not analyzed", color: "bg-slate-100 text-slate-600" },
};

export function MoveQualityBadge({ quality, showLabel = false }: { quality?: MoveQuality | null; showLabel?: boolean }) {
  const badge = badges[quality ?? "pending"];
  return (
    <span title={badge.label} aria-label={badge.label} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.color}`}>
      <span aria-hidden="true">{badge.symbol}</span>
      {showLabel && <span aria-hidden="true">{badge.label}</span>}
    </span>
  );
}
