import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listPracticePuzzles } from "@/lib/puzzles/practice-repository";
import { Icon } from "@/components/ui/icon";
import { SimplePage } from "@/components/ui/simple-page";
import shared from "@/components/ui/simple-page.module.css";

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
  return <SimplePage title={gameId ? "Puzzles from this game" : "Your puzzles"} description="Practice one move at a time. Progress and assistance are saved to your account.">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-[var(--fg-3)]">{count} {count === 1 ? "puzzle" : "puzzles"}</p>
      <Link className={shared.primary} href={gameId ? `/replay?game=${gameId}` : "/replay"}>Beat your past self <Icon name="arrow" size={14} /></Link>
    </div>
    {!rows.length && <div className={`${shared.card} mt-6 text-center`}><p className="font-medium">{count ? "No puzzles on this page." : "No puzzles yet"}</p>{!count && <p className="mt-2 text-sm text-[var(--fg-3)]">Open a saved game, finish engine analysis, and choose Generate puzzles.</p>}</div>}
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(puzzle => {
        const progress = puzzle.progress[0];
        return <li key={puzzle.id} className={`${shared.card} relative transition-colors hover:border-[var(--border)]`}>
          <Link href={`/puzzles/${puzzle.id}`} className="font-semibold after:absolute after:inset-0 after:rounded-[inherit]">{puzzle.generation.game.whiteName ?? "White"} vs. {puzzle.generation.game.blackName ?? "Black"} · half-move {puzzle.sourcePly}</Link>
          <p className="mt-2 text-sm text-[var(--fg-2)]">{puzzle.playerColor === "WHITE" ? "White" : "Black"} to play · Version {puzzle.generation.version}</p>
          <p className="mt-2 text-sm text-[var(--fg-3)]">{progress?.completedAt ? `Completed · ${progress.completionAssisted ? "Assisted" : "Unassisted"}` : progress?.state === "REVEALED" ? "Revealed · Retry to solve" : progress ? "In progress" : "Not started"}</p>
        </li>;
      })}
    </ul>
    <nav aria-label="Puzzle pages" className="mt-6 flex gap-4 text-sm">
      {page > 1 && <Link href={pageUrl(page - 1)} className={shared.link}>Previous page</Link>}
      {page * 24 < count && <Link href={pageUrl(page + 1)} className={shared.link}>Next page</Link>}
    </nav>
    <div className="mt-8 flex gap-5 text-sm"><Link href={gameId ? `/games/${gameId}` : "/games"} className={shared.link}>{gameId ? "Return to game" : "Your games"}</Link>{gameId && <Link href="/puzzles" className={shared.link}>All puzzles</Link>}</div>
  </SimplePage>;
}
