import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ExerciseEditor } from "@/components/learning/exercise-editor";
export const dynamic = "force-dynamic";
export default async function NewExercise({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
  const user = await requireUser(); const { chapter: id } = await searchParams;
  if (!id) notFound(); const db = getDb();
  const chapter = await db.learningChapter.findFirst({ where: { id, archived: false, material: { ownerId: user.id, shared: false, archived: false } } }); if (!chapter) notFound();
  const books = await db.book.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8"><Link className="text-sm underline" href={`/learning/chapters/${chapter.id}`}>{chapter.title}</Link><h1 className="mt-4 text-3xl font-semibold">Add exercise</h1><ExerciseEditor chapterId={chapter.id} books={books.map(book => ({ id: book.id, title: book.name }))} /></main>;
}
