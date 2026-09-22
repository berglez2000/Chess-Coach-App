import { AnalysisControls } from "@/components/games/analysis-controls";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { findGame } from "@/lib/games/queries";
import { GameReview } from "@/components/games/game-review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved game | Chess Coach" };

export default async function SavedGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const saved = await findGame(getDb(), id);
  if (!saved) notFound();
  return <main id="main-content" className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
    <Link href="/games" className="underline">Your games</Link>
    <h1 className="mt-6 text-3xl font-semibold">Saved game</h1>
    <AnalysisControls gameId={saved.id} status={saved.status} error={saved.analysisError} leaseUntil={saved.analysisLeaseUntil} />
    <GameReview key={saved.id} game={saved.game} userColor={saved.userColor} status={saved.status} />
  </main>;
}
