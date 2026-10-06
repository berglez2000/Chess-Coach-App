import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { library } from "@/lib/learning/repository";
import { ContentForm } from "@/components/learning/content-form";
export const dynamic = "force-dynamic";
export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const material = (await library(getDb(), user.id)).find(row => row.id === id); if (!material) notFound();
  const editable = material.ownerId === user.id && !material.shared;
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
    <Link href="/learning/materials" className="text-sm underline">Learning library</Link><h1 className="mt-4 text-3xl font-semibold">{material.title}</h1><p className="mt-2 text-sm">{material.edition}</p>
    {!material.chapters.length && <p className="mt-6">No chapters yet.</p>}
    <ol className="mt-6 space-y-4">{material.chapters.map(chapter => {
      const playable = chapter.exercises.filter(e => e.published);
      return <li key={chapter.id} className="rounded-xl border bg-white p-4"><Link className="font-semibold underline" href={`/learning/chapters/${chapter.id}`}>{chapter.title}</Link>
        <p className="mt-2 text-sm">{playable.filter(e => e.published?.progress[0]?.completedAt).length} / {playable.length} current exercises completed</p>
        {editable && <details className="mt-3"><summary>Edit chapter</summary><ContentForm kind="chapter" label="Save chapter" initial={{ id: chapter.id, materialId: id, title: chapter.title, order: chapter.order, expectedRevision: chapter.revision }} /></details>}</li>;
    })}</ol>
    {editable && <><details className="mt-6 rounded-xl border p-4"><summary>Add chapter</summary><ContentForm kind="chapter" label="Create chapter" initial={{ materialId: id, order: material.chapters.length }} /></details>
      <details className="mt-4 rounded-xl border p-4"><summary>Edit material</summary><ContentForm kind="material" label="Save material" initial={{ id, title: material.title, edition: material.edition, expectedRevision: material.revision }} /></details></>}
  </main>;
}
