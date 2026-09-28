import Link from "next/link";
import type { GameSummary } from "@/types/saved-game";

export function GameSummaryList({ games }: { games: GameSummary[] }) {
  return (
      <ul className="mt-8 space-y-4">{games.map(game => <li key={game.id} className="rounded-lg border border-[#20382e]/20 bg-white p-5">
        <Link href={`/games/${game.id}`} className="text-lg font-semibold underline">{game.whiteName ?? "White"} vs. {game.blackName ?? "Black"}</Link>
        <p className="mt-2">Result: {game.result} · You played {game.userColor === "WHITE" ? "White" : "Black"}</p>
        <p className="mt-1 text-sm">{game.playedAt ? `Played ${game.playedAt.slice(0, 10)}` : "Date unknown"}{game.openingName ? ` · ${game.openingName}` : ""}</p>
        <p className="mt-1 text-sm">Analysis: {game.status.toLowerCase().replaceAll("_", " ")}</p>
      </li>)}</ul>
  );
}
