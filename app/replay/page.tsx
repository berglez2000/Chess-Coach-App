import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { replayLibrary } from "@/lib/replay/repository";
import { StartReplay } from "@/components/replay/start";
export const dynamic = "force-dynamic";
export const metadata = { title: "Beat your past self | Chess Coach" };
export default async function ReplayPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const user = await requireUser(); const query = await searchParams;
  const gameId = typeof query.game === "string" ? query.game : undefined;
  const db = getDb();
  if (gameId && !await db.game.findFirst({ where: { id: gameId, ownerId: user.id } })) notFound();
  const library = await replayLibrary(db, user.id, gameId);
  const active = library.sessions.find(session => !session.completed);
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
    <h1 className="text-3xl font-semibold">Beat your past self</h1>
    <p className="mt-3 text-[#465c50]">Find improvements in positions from your own games. Your original move appears after you solve or reveal the validated sequence.</p>
    <section className="mt-6 rounded-2xl border border-[#20382e]/15 bg-white p-5"><h2 className="text-lg font-semibold">A fresh attempt</h2><p className="mt-2">Up to five challenges · {library.count} eligible puzzles{gameId ? " from this game" : ""}.</p>
      <p className="mt-2 text-sm">These challenges use validated winning tactics from mistakes and blunders. Every session saves its own attempts.</p>
      {active ? <Link className="mt-4 inline-block font-semibold underline" href={`/replay/${active.id}`}>Resume current session →</Link> : <StartReplay gameId={gameId} disabled={!library.count} />}
      {!library.count && <p className="mt-3">No eligible puzzles yet. Open a saved game, complete engine analysis, and choose Generate puzzles. Games without a validated winning tactic may have no challenges.</p>}
    </section>
    <section className="mt-6"><h2 className="text-lg font-semibold">Recent sessions</h2><ul className="mt-3 space-y-3">{library.sessions.map(session => <li key={session.id}><Link className="underline" href={`/replay/${session.id}`}>{session.completed ? "Completed" : "In progress"} · {session.results.firstTry} of {session.total} solved first try without hints</Link></li>)}</ul>{!library.sessions.length && <p className="mt-2 text-sm">Your completed sessions will appear here.</p>}</section>
    <nav className="mt-6 flex gap-4 text-sm"><Link className="underline" href={gameId ? `/games/${gameId}` : "/games"}>Return to games</Link><Link className="underline" href="/puzzles">Your puzzles</Link></nav>
  </main>;
}
