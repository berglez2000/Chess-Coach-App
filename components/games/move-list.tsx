import type { ParsedGameMove } from "@/types/game";
import type { ReviewCoachingAnnotation } from "@/types/saved-game";

type ReviewMove = ParsedGameMove & { coaching?: ReviewCoachingAnnotation | null };

const CLASSIFICATION_DOT: Record<string, string> = {
  blunder: "bg-red-500",
  mistake: "bg-orange-400",
  inaccuracy: "bg-yellow-400",
};

export function MoveList({ moves, selectedPly, onSelect }: {
  moves: ReviewMove[];
  selectedPly: number;
  onSelect: (ply: number) => void;
}) {
  const rows = new Map<number, { white?: ReviewMove; black?: ReviewMove }>();
  for (const move of moves) {
    const row = rows.get(move.moveNumber) ?? {};
    row[move.color === "WHITE" ? "white" : "black"] = move;
    rows.set(move.moveNumber, row);
  }
  return (
    <div className="max-h-96 overflow-y-auto rounded-lg border border-[#20382e]/20">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Game moves</caption>
        <thead className="sticky top-0 bg-[#eeeee5]">
          <tr><th scope="col" className="p-3">Move</th><th scope="col" className="p-3">White</th><th scope="col" className="p-3">Black</th></tr>
        </thead>
        <tbody>
          {[...rows].map(([number, row]) => (
            <tr key={number}>
              <th scope="row" className="px-3 py-2 font-normal">{number}.</th>
              {(["white", "black"] as const).map((side) => {
                const move = row[side];
                return <td key={side} className="p-1">
                  {move ? <button type="button" onClick={() => onSelect(move.ply)}
                    aria-label={`${number}. ${side === "white" ? "White" : "Black"} ${move.san}${move.coaching ? ` — ${move.coaching.classification}` : ""}`}
                    aria-current={selectedPly === move.ply ? "step" : undefined}
                    className={`flex w-full items-center gap-1.5 rounded px-3 py-2 text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-1 ${selectedPly === move.ply ? "bg-[#20382e] text-white" : "hover:bg-[#20382e]/10"}`}>
                    {move.coaching && CLASSIFICATION_DOT[move.coaching.classification] && (
                      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${CLASSIFICATION_DOT[move.coaching.classification]}`} aria-hidden="true" />
                    )}
                    {move.san}
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
