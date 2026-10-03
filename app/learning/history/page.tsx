import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const user = await requireUser();
  const rows = await getDb().learningProgress.findMany({ where: { userId: user.id, definition: { exercise: { chapter: { material: { OR: [{ ownerId: user.id }, { shared: true }] } } } } },
    orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }], take: 200,
    include: { definition: { include: { exercise: { include: { chapter: { include: { material: true } } } } } } } });
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8"><Link className="text-sm underline" href="/learning">Learning library</Link><h1 className="mt-4 text-3xl font-semibold">Exercise history</h1><p className="mt-3 text-sm">Your most recent 200 exercise revisions, including earlier answers and archived content.</p>
    {!rows.length && <p className="mt-6">No saved attempts yet.</p>}
    <ul className="mt-6 space-y-4">{rows.map(row => { const exercise = row.definition.exercise; const chapter = exercise.chapter; const active = !exercise.archived && !chapter.archived && !chapter.material.archived;
      return <li key={row.id} className="rounded-xl border bg-white p-4"><p className="font-semibold">{chapter.material.title} · {chapter.title} · {exercise.number}. {exercise.title}</p><p className="mt-2 text-sm">Revision {row.definition.version} · {row.completedAt ? `Completed ${row.completedAt.toISOString().slice(0,10)} · ${row.completionAssisted ? "Assisted" : "Unassisted"}` : row.state === "REVEALED" ? "Revealed; not completed" : "In progress"} · {row.moveAttempts} moves tried</p>
        {active ? <Link className="mt-2 inline-block text-sm underline" href={`/learning/exercises/${exercise.id}?revision=${row.revisionId}`}>Open this revision</Link> : <p className="mt-2 text-sm">Archived; history retained</p>}</li>;
    })}</ul></main>;
}
