import { requireUser } from "@/lib/auth/session";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getDashboard } from "@/lib/games/queries";
import { GameSummaryList } from "@/components/games/game-summary-list";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  let dashboard: Awaited<ReturnType<typeof getDashboard>> | null = null;
  try {
    dashboard = await getDashboard(getDb(), user.id);
  } catch {
    // Expected local database outages must not hide navigation or expose details.
  }
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
      <p className="text-sm font-semibold tracking-widest uppercase">
        Your games. Your lessons.
      </p>
      <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
        Learn from every move.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-[#465c50]">
        A place to revisit your games, understand important decisions, and bring
        those lessons to your next game.
      </p>
      <Link href="/games/new" className="mt-10 inline-block rounded-lg bg-[#20382e] px-6 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4">
        Import Game
      </Link>
      <Link href="/games" className="ml-6 inline-block underline">My Games</Link>
      <section aria-labelledby="recent-games-heading" className="mt-10">
        <h2 id="recent-games-heading" className="text-2xl font-semibold">Recent games</h2>
        {dashboard ? <>
          <p className="mt-3">{dashboard.count} saved {dashboard.count === 1 ? "game" : "games"}</p>
          {dashboard.count === 0 ?
            <p className="mt-4">No saved games yet. Choose Import Game above to review your first game.</p> :
            <GameSummaryList games={dashboard.recentGames} />}
        </> : <div className="mt-4 space-y-3">
          <p role="alert">Could not load your saved games. Check that local PostgreSQL is running, then try again.</p>
          {/* A full reload retries the database read even when this route is already active. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="inline-block underline">Try again</a>
        </div>}
      </section>
    </main>
  );
}
