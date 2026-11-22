import type { MoveQuality } from "@/types/analysis";

const badges = {
  normal: { symbol: "✓", label: "Okay", color: "bg-[var(--quality-good-bg)] text-[var(--quality-good)]" },
  inaccuracy: { symbol: "?!", label: "Inaccuracy", color: "bg-[var(--quality-inaccuracy-bg)] text-[var(--quality-inaccuracy)]" },
  mistake: { symbol: "?", label: "Mistake", color: "bg-[var(--quality-mistake-bg)] text-[var(--quality-mistake)]" },
  blunder: { symbol: "??", label: "Blunder", color: "bg-[var(--quality-blunder-bg)] text-[var(--quality-blunder)]" },
  unknown: { symbol: "—", label: "Unclassified", color: "bg-[var(--quality-unknown-bg)] text-[var(--quality-unknown)]" },
  pending: { symbol: "·", label: "Not analyzed", color: "bg-[var(--quality-unknown-bg)] text-[var(--quality-unknown)]" },
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
