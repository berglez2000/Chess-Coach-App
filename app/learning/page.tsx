import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { library } from "@/lib/learning/repository";
import { ContentForm } from "@/components/learning/content-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Learning library | Chess Coach" };
export default async function LearningPage() {
  const user = await requireUser(); const materials = await library(getDb(), user.id);
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
    <h1 className="text-3xl font-semibold">Learning library</h1>
    <p className="mt-3 text-sm">Study books by chapter and practice their exercises. Your exercise progress is saved separately from PDF reading progress.</p>
    <Link href="/learning/history" className="mt-3 inline-block text-sm underline">Exercise history</Link>
    {!materials.length && <p className="mt-6">No learning materials yet. Create a material or add the supplied Mate in One sample.</p>}
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">{materials.map(material => {
      const exercises = material.chapters.flatMap(chapter => chapter.exercises).filter(e => e.published);
      return <li key={material.id} className="rounded-2xl border border-[#20382e]/15 bg-white p-5"><Link className="font-semibold underline" href={`/learning/${material.id}`}>{material.title}</Link>
        <p className="mt-2 text-sm">{material.shared ? "Shared curated material" : "Private material"} · {material.chapters.length} chapters</p>
        <p className="mt-2 text-sm">{exercises.filter(e => e.published?.progress[0]?.completedAt).length} / {exercises.length} current exercises completed</p></li>;
    })}</ul>
    <details className="mt-6 rounded-xl border p-4"><summary>Create a material</summary><ContentForm kind="material" label="Create private material" /></details>
    <div className="mt-6 rounded-xl border p-4"><p className="text-sm">Add your supplied exercise: The pin is mightier than the sword. This creates one private book chapter and one validated exercise in your account.</p><ContentForm kind="sample" label="Add Mate in One sample" /></div>
  </main>;
}
