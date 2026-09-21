import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listGames } from "@/lib/games/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your games | Chess Coach" };

export default async function GamesPage() {
  const games = await listGames(getDb());
  return <main id="main-content" className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
    <h1 className="text-3xl font-semibold">Your games</h1>
    <Link href="/games/new" className="mt-4 inline-block underline">Import a game</Link>
    {games.length === 0 ? <p className="mt-8">No saved games yet. Import your first game to start reviewing.</p> :
      <ul className="mt-8 space-y-4">{games.map(game => <li key={game.id} className="rounded-lg border border-[#20382e]/20 bg-white p-5">
        <Link href={`/games/${game.id}`} className="text-lg font-semibold underline">{game.whiteName ?? "White"} vs. {game.blackName ?? "Black"}</Link>
        <p className="mt-2">Result: {game.result} · You played {game.userColor === "WHITE" ? "White" : "Black"}</p>
        <p className="mt-1 text-sm">{game.playedAt ? `Played ${game.playedAt.slice(0, 10)}` : "Date unknown"}{game.openingName ? ` · ${game.openingName}` : ""}</p>
        <p className="mt-1 text-sm">Analysis: {game.status.toLowerCase().replaceAll("_", " ")}</p>
      </li>)}</ul>}
  </main>;
}
