import { requireUser } from "@/lib/auth/session";
import { AnalysisControls } from "@/components/games/analysis-controls";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { findGame } from "@/lib/games/queries";
import { GameReview } from "@/components/games/game-review";
import { PuzzleGenerationControls } from "@/components/puzzles/generation-controls";
import { listPracticePuzzles } from "@/lib/puzzles/practice-repository";
import { puzzleSummary } from "@/lib/puzzles/repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Game review | Chess Coach" };

export default async function SavedGamePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ analyze?: string; ply?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const autoStart = query?.analyze === "1";
  const initialPly = /^\d+$/.test(query?.ply ?? "") ? Number(query!.ply) : 0;
  const saved = await findGame(getDb(), id, user.id);
  if (!saved) notFound();
  const [generation, puzzles] = await Promise.all([puzzleSummary(getDb(), id, user.id), listPracticePuzzles(getDb(), user.id, id)]);
  return <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-3)]"><Link href="/" className="hover:underline">Dashboard</Link><span aria-hidden="true">/</span><Link href="/games" className="hover:underline">Your games</Link><span aria-hidden="true">/</span><span className="text-[var(--fg-2)]">Game review</span></nav>
    <AnalysisControls coachingRevision={saved.coachingRevision} autoStart={autoStart} gameId={saved.id} status={saved.status} error={saved.analysisError} leaseUntil={saved.analysisLeaseUntil} />
    <GameReview key={`${saved.id}:${initialPly}`} initialPly={initialPly} game={saved.game} userColor={saved.userColor} status={saved.status} />
    {puzzles.rows.length > 0 && <section aria-label="Personal puzzles" className="mt-6 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Practice your key moments</h2><Link href={`/puzzles?game=${id}`} className="text-sm font-semibold underline">Practice all puzzles →</Link></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{puzzles.rows.map(puzzle => {
        const move = saved.game.moves.find(move => move.ply === puzzle.sourcePly);
        const progress = puzzle.progress[0];
        return <Link key={puzzle.id} href={`/puzzles/${puzzle.id}`} className="rounded-xl border border-[var(--border-light)] p-4 transition-colors hover:bg-[var(--surface-2)]"><p className="text-sm font-semibold">Find the best continuation</p><p className="mt-2 text-xs text-[var(--fg-3)]">{move ? `Move ${move.moveNumber}${move.color === "BLACK" ? "…" : "."}` : `Half-move ${puzzle.sourcePly}`} · {progress?.completedAt ? progress.completionAssisted ? "Solved with assistance" : "Solved unassisted ✓" : progress ? "In progress" : "Not attempted"}</p></Link>;
      })}</div>
    </section>}
    <PuzzleGenerationControls key={saved.id} gameId={id} ready={saved.status !== "ENGINE_RUNNING" && saved.game.moves.length > 0 && saved.game.moves.every(move => move.analysis)} generation={generation} />
  </main>;
}
