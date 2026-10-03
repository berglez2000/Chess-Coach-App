import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { library, practice } from "@/lib/learning/repository";
import { PuzzleSolver } from "@/components/puzzles/puzzle-solver";
export const dynamic = "force-dynamic";
export default async function PracticeExercise({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ revision?: string }> }) {
  const user = await requireUser(); const { id } = await params; const { revision } = await searchParams; const db = getDb();
  const puzzle = await practice(db, user.id, id, revision); if (!puzzle) notFound();
  if (!revision) redirect(`/learning/exercises/${id}?revision=${puzzle.learning.revisionId}`);
  const material = (await library(db, user.id)).find(m => m.chapters.some(c => c.exercises.some(e => e.id === id)));
  const chapter = material?.chapters.find(c => c.exercises.some(e => e.id === id)); const exercise = chapter?.exercises.find(e => e.id === id); if (!chapter || !exercise || !material) notFound();
  const siblings = chapter.exercises.filter(e => e.published); const index = siblings.findIndex(e => e.id === id);
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
    <nav aria-label="Learning context" className="flex flex-wrap gap-3 text-sm"><Link className="underline" href={`/learning/${material.id}`}>{material.title}</Link><Link className="underline" href={`/learning/chapters/${chapter.id}`}>{chapter.title}</Link></nav>
    <h1 className="mt-4 text-3xl font-semibold">{exercise.number}. {exercise.title}</h1>
    {puzzle.learning.revisionId !== exercise.published?.id && <p className="mt-3 text-sm">You are finishing an earlier revision. Its completion stays in history; the revised exercise needs a fresh solve.</p>}
    {exercise.published && exercise.published.version > 1 && <p className="mt-2 text-sm">This exercise has been revised. Chapter totals use the current revision.</p>}
    <PuzzleSolver key={puzzle.learning.revisionId} initialPuzzle={puzzle} nextId={null} learningNavigation={{ chapterUrl: `/learning/chapters/${chapter.id}`, previousUrl: index > 0 ? `/learning/exercises/${siblings[index-1].id}` : null, nextUrl: siblings[index+1] ? `/learning/exercises/${siblings[index+1].id}` : null }} />
  </main>;
}
