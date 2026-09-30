import { requireUser } from "@/lib/auth/session";
import { GameSummaryList } from "@/components/games/game-summary-list";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listGames } from "@/lib/games/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your games | Chess Coach" };

export default async function GamesPage() {
  const user = await requireUser();
  const games = await listGames(getDb(), user.id);
  return <main id="main-content" className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
    <h1 className="text-3xl font-semibold">Your games</h1>
    <Link href="/games/new" className="mt-4 inline-block underline">Import a game</Link>
    {games.length === 0 ? <p className="mt-8">No saved games yet. Import your first game to start reviewing.</p> :
      <GameSummaryList games={games} />}
  </main>;
}
