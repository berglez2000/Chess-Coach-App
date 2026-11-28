"use client";

import { useEffect, useRef } from "react";
import type { ParsedGameMove } from "@/types/game";
import type { ReviewAnalysis } from "@/lib/analysis/review";
import type { ReviewCoachingAnnotation } from "@/types/saved-game";
import { MoveQualityBadge } from "./move-quality-badge";

type ReviewMove = ParsedGameMove & { coaching?: ReviewCoachingAnnotation | null; positiveHighlight?: boolean; analysis?: ReviewAnalysis | null; pgnAnnotation?: string };

export function MoveList({ moves, selectedPly, onSelect }: {
  moves: ReviewMove[];
  selectedPly: number;
  onSelect: (ply: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Scroll only the list: scrollIntoView would also scroll the page away from the board.
    const list = listRef.current, selected = selectedRef.current;
    if (!list || !selected) return;
    const view = list.getBoundingClientRect(), item = selected.getBoundingClientRect();
    const top = view.top + (list.querySelector("thead")?.offsetHeight ?? 0);
    if (item.top < top) list.scrollTop -= top - item.top;
    else if (item.bottom > view.bottom) list.scrollTop += item.bottom - view.bottom;
  }, [selectedPly]);

  const rows = new Map<number, { white?: ReviewMove; black?: ReviewMove }>();
  for (const move of moves) {
    const row = rows.get(move.moveNumber) ?? {};
    row[move.color === "WHITE" ? "white" : "black"] = move;
    rows.set(move.moveNumber, row);
  }
  return (
    <div ref={listRef} className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Game moves</caption>
        <thead className="sticky top-0 bg-[var(--surface-2)]">
          <tr><th scope="col" className="p-3">Move</th><th scope="col" className="p-3">White</th><th scope="col" className="p-3">Black</th></tr>
        </thead>
        <tbody>
          {[...rows].map(([number, row]) => (
            <tr key={number}>
              <th scope="row" className="px-3 py-2 font-normal">{number}.</th>
              {(["white", "black"] as const).map((side) => {
                const move = row[side];
                return <td key={side} className="p-1">
                  {move ? <button type="button" ref={selectedPly === move.ply ? selectedRef : undefined} onClick={() => onSelect(move.ply)}
                    aria-label={`${number}. ${side === "white" ? "White" : "Black"} ${move.san}${move.pgnAnnotation ?? ""}${(move.analysis?.quality ?? move.coaching?.classification) ? ` — ${move.analysis?.quality ?? move.coaching?.classification}` : ""}${move.positiveHighlight ? " — Positive highlight" : ""}`}
                    aria-current={selectedPly === move.ply ? "step" : undefined}
                    className={`flex w-full items-center gap-1.5 rounded px-3 py-2 text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-1 ${selectedPly === move.ply ? "bg-[var(--green)] text-[var(--on-green)]" : "hover:bg-[var(--green-subtle)]"}`}>
                    {move.san}{move.pgnAnnotation && <span className="font-mono" title="Annotation from the PGN">{move.pgnAnnotation}</span>}
                    <MoveQualityBadge quality={move.analysis?.quality ?? move.coaching?.classification} variant={selectedPly === move.ply ? "contrast" : "tint"} />
                    {move.positiveHighlight && <span className="rounded border border-current px-1 text-xs">Positive highlight</span>}
                  </button> : <span className="px-3" aria-label="No move">—</span>}
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
