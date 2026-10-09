import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listPracticePuzzles } from "@/lib/puzzles/practice-repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your puzzles | Chess Coach" };
export default async function PuzzlesPage({ searchParams }: { searchParams: Promise<{ game?: string; page?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const gameId = typeof query.game === "string" ? query.game : undefined;
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page ?? "1", 10) || 1));
  const db = getDb();
  if (gameId && !await db.game.findUnique({ where: { id: gameId, ownerId: user.id }, select: { id: true } })) notFound();
  const { count, rows } = await listPracticePuzzles(db, user.id, gameId, page);
  const pageUrl = (value: number) => `/puzzles?${new URLSearchParams({ ...(gameId ? { game: gameId } : {}), page: String(value) })}`;
  return <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
    <h1 className="text-3xl font-semibold">{gameId ? "Puzzles from this game" : "Your puzzles"}</h1>
    <p className="mt-3 text-sm text-[#465c50]">Practice one move at a time. Progress and assistance are saved to your account.</p>
    <Link className="mt-4 inline-block font-semibold underline" href={gameId ? `/replay?game=${gameId}` : "/replay"}>Beat your past self →</Link>
    <p className="mt-2 text-sm">{count} {count === 1 ? "puzzle" : "puzzles"}</p>
    {!rows.length && <p className="mt-6">{count ? "No puzzles on this page." : "No puzzles yet. Open a saved game, finish engine analysis, and choose Generate puzzles."}</p>}
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(puzzle => {
        const progress = puzzle.progress[0];
        return <li key={puzzle.id} className="rounded-2xl border border-[#20382e]/15 bg-white p-5">
          <Link href={`/puzzles/${puzzle.id}`} className="font-semibold underline">{puzzle.generation.game.whiteName ?? "White"} vs. {puzzle.generation.game.blackName ?? "Black"} · half-move {puzzle.sourcePly}</Link>
          <p className="mt-2 text-sm">{puzzle.playerColor === "WHITE" ? "White" : "Black"} to play · Version {puzzle.generation.version}</p>
          <p className="mt-2 text-sm">{progress?.completedAt ? `Completed · ${progress.completionAssisted ? "Assisted" : "Unassisted"}` : progress?.state === "REVEALED" ? "Revealed · Retry to solve" : progress ? "In progress" : "Not started"}</p>
        </li>;
      })}
    </ul>
    <nav aria-label="Puzzle pages" className="mt-6 flex gap-4 text-sm">
      {page > 1 && <Link href={pageUrl(page - 1)} className="underline">Previous page</Link>}
      {page * 24 < count && <Link href={pageUrl(page + 1)} className="underline">Next page</Link>}
    </nav>
    <div className="mt-6 flex gap-4 text-sm"><Link href={gameId ? `/games/${gameId}` : "/games"} className="underline">{gameId ? "Return to game" : "Your games"}</Link>{gameId && <Link href="/puzzles" className="underline">All puzzles</Link>}</div>
  </main>;
}
