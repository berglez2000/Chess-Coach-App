import type { MoveQuality } from "@/types/analysis";

const badges = {
  normal: { symbol: "✓", label: "Okay", color: "[--q:var(--quality-good)] [--q-bg:var(--quality-good-bg)]" },
  inaccuracy: { symbol: "?!", label: "Inaccuracy", color: "[--q:var(--quality-inaccuracy)] [--q-bg:var(--quality-inaccuracy-bg)]" },
  mistake: { symbol: "?", label: "Mistake", color: "[--q:var(--quality-mistake)] [--q-bg:var(--quality-mistake-bg)]" },
  blunder: { symbol: "??", label: "Blunder", color: "[--q:var(--quality-blunder)] [--q-bg:var(--quality-blunder-bg)]" },
  unknown: { symbol: "—", label: "Unclassified", color: "[--q:var(--quality-unknown)] [--q-bg:var(--quality-unknown-bg)]" },
  pending: { symbol: "·", label: "Not analyzed", color: "[--q:var(--quality-unknown)] [--q-bg:var(--quality-unknown-bg)]" },
};

const pill = "min-w-7 gap-1.5 px-2 py-0.5 text-sm font-semibold";
const variants = {
  /** Quiet tint for dark surfaces. */
  tint: `${pill} bg-[var(--q-bg)] text-[var(--q)]`,
  /** Dark pill for accent-colored surfaces such as the selected move. */
  contrast: `${pill} bg-[var(--bg)] text-[var(--q)]`,
  /** Opaque marker for the board; scales with the nearest size container (the square). */
  board: "size-[max(40cqw,20px)] text-[length:max(22cqw,11px)] font-bold leading-none bg-[var(--q)] text-[var(--bg)] ring-2 ring-[var(--bg)] shadow-[0_2px_6px_rgb(0_0_0/0.55)]",
};

export function MoveQualityBadge({ quality, showLabel = false, variant = "tint" }: { quality?: MoveQuality | null; showLabel?: boolean; variant?: keyof typeof variants }) {
  const badge = badges[quality ?? "pending"];
  return (
    <span title={badge.label} aria-label={badge.label} className={`inline-flex shrink-0 items-center justify-center rounded-full ${badge.color} ${variants[variant]}`}>
      <span aria-hidden="true">{badge.symbol}</span>
      {showLabel && <span aria-hidden="true">{badge.label}</span>}
    </span>
  );
}
