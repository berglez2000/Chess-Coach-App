import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { editorExercise } from "@/lib/learning/repository";
import { contentSchema } from "@/lib/learning/content";
import { ExerciseEditor } from "@/components/learning/exercise-editor";
export const dynamic = "force-dynamic";
export default async function EditExercise({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params; const db = getDb();
  const exercise = await editorExercise(db, user.id, id); if (!exercise) notFound();
  const books = await db.book.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8"><Link className="text-sm underline" href={`/learning/chapters/${exercise.chapterId}`}>{exercise.chapter.title}</Link><h1 className="mt-4 text-3xl font-semibold">Edit exercise</h1><ExerciseEditor key={id} chapterId={exercise.chapterId} books={books.map(book => ({ id: book.id, title: book.name }))} initial={{ id, revision: exercise.revision, number: exercise.number, title: exercise.title, order: exercise.order, archived: exercise.archived, status: exercise.status, content: contentSchema.parse(exercise.draft) }} /></main>;
}
