import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { findPracticePuzzle, nextPracticePuzzle } from "@/lib/puzzles/practice-repository";
import { PuzzleSolver } from "@/components/puzzles/puzzle-solver";

export const dynamic = "force-dynamic";
export const metadata = { title: "Practice puzzle | Chess Coach" };
export default async function PuzzlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const db = getDb();
  const puzzle = await findPracticePuzzle(db, id, user.id);
  if (!puzzle) notFound();
  const nextId = await nextPracticePuzzle(db, id, user.id);
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
    <h1 className="text-3xl font-semibold">Practice your game</h1>
    <PuzzleSolver key={id} initialPuzzle={puzzle} nextId={nextId} />
  </main>;
}
