import { requireUser } from "@/lib/auth/session";
import { AnalysisControls } from "@/components/games/analysis-controls";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { findGame } from "@/lib/games/queries";
import { GameReview } from "@/components/games/game-review";
import { PuzzleGenerationControls } from "@/components/puzzles/generation-controls";
import { puzzleSummary } from "@/lib/puzzles/repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved game | Chess Coach" };

export default async function SavedGamePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ analyze?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const autoStart = (await searchParams)?.analyze === "1";
  const saved = await findGame(getDb(), id, user.id);
  if (!saved) notFound();
  const generation = await puzzleSummary(getDb(), id, user.id);
  return <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
    <Link href="/games" className="underline">Your games</Link>
    <h1 className="sr-only">Saved game</h1>
    <AnalysisControls coachingRevision={saved.coachingRevision} autoStart={autoStart} gameId={saved.id} status={saved.status} error={saved.analysisError} leaseUntil={saved.analysisLeaseUntil} />
    <GameReview key={saved.id} game={saved.game} userColor={saved.userColor} status={saved.status} />
    <PuzzleGenerationControls key={saved.id} gameId={id} ready={saved.status !== "ENGINE_RUNNING" && saved.game.moves.length > 0 && saved.game.moves.every(move => move.analysis)} generation={generation} />
  </main>;
}
