import Link from "next/link";
import { PinLesson } from "@/components/learning/pin-lesson";
import { SkewerLesson } from "@/components/learning/skewer-lesson";
import { DeflectionLesson } from "@/components/learning/deflection-lesson";
import { DoubleCheckLesson } from "@/components/learning/double-check-lesson";
import { DiscoveredCheckLesson } from "@/components/learning/discovered-check-lesson";
import { DiscoveredAttackLesson } from "@/components/learning/discovered-attack-lesson";
import { DoubleAttackLesson } from "@/components/learning/double-attack-lesson";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { library } from "@/lib/learning/repository";
export const dynamic = "force-dynamic";
export default async function ChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params; const materials = await library(getDb(), user.id);
  const material = materials.find(m => m.chapters.some(c => c.id === id)); const chapter = material?.chapters.find(c => c.id === id); if (!material || !chapter) notFound();
  const editable = material.ownerId === user.id && !material.shared;
  const playable = chapter.exercises.filter(e => e.published);
  const inProgress = playable.find(e => e.published!.progress[0]?.state === "SOLVING" && !e.published!.progress[0]?.completedAt && e.published!.progress.length);
  const next = inProgress ?? playable.find(e => !e.published!.progress[0]?.completedAt) ?? playable[0];
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
    <Link className="text-sm underline" href={`/learning/${material.id}`}>{material.title}</Link><h1 className="mt-4 text-3xl font-semibold">{chapter.title}</h1>
    {material.title === "1001 chess exercises for beginners" && chapter.title === "Double attack" && <DoubleAttackLesson />}
    {material.title === "1001 chess exercises for beginners" && chapter.title === "Discovered attack" && <DiscoveredAttackLesson />}
    {material.title === "1001 chess exercises for beginners" && chapter.title === "Discovered check" && <DiscoveredCheckLesson />}
    {material.title === "1001 chess exercises for beginners" && chapter.title === "Double check" && <DoubleCheckLesson />}
    {material.title === "1001 chess exercises for beginners" && chapter.title === "Pin" && <PinLesson />}
    {material.title === "1001 chess exercises for beginners" && chapter.title === "Skewer" && <SkewerLesson />}
    {material.title === "1001 chess exercises for beginners" && chapter.title === "Deflection" && <DeflectionLesson />}
    <p className="mt-3 text-sm">{playable.filter(e => e.published!.progress[0]?.completedAt).length} / {playable.length} current exercises completed</p>
    {next ? <Link className="mt-4 inline-block font-semibold underline" href={`/learning/exercises/${next.id}`}>{playable.every(e => e.published!.progress[0]?.completedAt) ? "Repeat chapter practice" : "Resume chapter"}</Link> : <p className="mt-4">No published exercises to practice yet.</p>}
    <ol className="mt-6 space-y-4">{chapter.exercises.map(exercise => <li key={exercise.id} className="rounded-xl border bg-white p-4">
      {exercise.published ? <Link className="font-semibold underline" href={`/learning/exercises/${exercise.id}`}>{exercise.number}. {exercise.title}</Link> : <p className="font-semibold">{exercise.number}. {exercise.title}</p>}
      <p className="mt-2 text-sm">{exercise.published?.progress[0]?.completedAt ? `Completed · ${exercise.published.progress[0].completionAssisted ? "Assisted" : "Unassisted"}` : exercise.published ? `Revision ${exercise.published.version} · ${exercise.published.progress.length ? "In progress" : "Not started"}` : "Draft · not available for practice"}</p>
      {editable && <><p className="mt-2 text-sm">Authoring: {exercise.status}{exercise.published && exercise.status !== "PUBLISHED" ? " · prior published revision remains playable" : ""}</p><Link className="mt-2 inline-block text-sm underline" href={`/learning/exercises/${exercise.id}/edit`}>Edit exercise</Link></>}
    </li>)}</ol>
    {editable && <Link className="mt-6 inline-block underline" href={`/learning/new?chapter=${id}`}>Add exercise</Link>}
  </main>;
}
