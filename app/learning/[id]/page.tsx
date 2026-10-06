import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { library } from "@/lib/learning/repository";
import { ContentForm } from "@/components/learning/content-form";
import styles from "@/components/learning/learning.module.css";
import { LearningProgress } from "@/components/learning/progress";
export const dynamic = "force-dynamic";
export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const material = (await library(getDb(), user.id)).find(row => row.id === id); if (!material) notFound();
  const editable = material.ownerId === user.id && !material.shared;
  const exercises = material.chapters.flatMap(c => c.exercises).filter(e => e.published);
  const completed = exercises.filter(e => e.published?.progress[0]?.completedAt).length;
  return <main id="main-content" className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/learning/materials">Learning library</Link><span>/</span><span>{material.title}</span></nav>
    <h1>{material.title}</h1><div className={styles.meta}><span className={`${styles.badge} ${material.shared ? styles.shared : ""}`}>{material.shared ? "Shared · Read-only" : "Private material"}</span>{material.edition && <span>{material.edition}</span>}</div>
    <section aria-label="Material progress" className={`${styles.card} ${styles.summary}`}><div><strong>{completed}</strong><p>Exercises completed</p><LearningProgress completed={completed} total={exercises.length}/></div><div><strong>{exercises.length}</strong><p>Total exercises</p><p>{exercises.length ? (completed / exercises.length * 100).toFixed(1) : 0}% done</p></div><div><strong>{material.chapters.length}</strong><p>Chapters</p></div></section>
    <div className={styles.heading}><h2>Chapters</h2><span className={styles.meta}>{material.chapters.length} chapters</span></div>
    {!material.chapters.length && <p className={styles.subtitle}>No chapters yet.</p>}
    <div className={styles.list}>{material.chapters.map((chapter, index) => {
      const playable = chapter.exercises.filter(e => e.published);
      const done = playable.filter(e => e.published?.progress[0]?.completedAt).length;
      const next = playable.find(e => e.published?.progress.length && !e.published.progress[0]?.completedAt) ?? playable.find(e => !e.published?.progress[0]?.completedAt) ?? playable[0];
      return <details id={`chapter-${chapter.id}`} key={chapter.id} className={`${styles.card} ${styles.chapter}`} open={index === 0}>
        <summary><span className={styles.icon}>{index + 1}</span><div className={styles.chapterInfo}><strong>{chapter.title}</strong><p className={styles.meta}><span>{playable.length} exercises</span><span>{done === playable.length && done > 0 ? "Completed" : playable.some(e => e.published?.progress.length) ? "In progress" : "Not started"}</span></p></div><div className={styles.chapterProgress}><LearningProgress completed={done} total={playable.length}/></div></summary>
        <div className={styles.chapterBody}><div className={styles.actions}>{next && <Link className={styles.primary} href={`/learning/exercises/${next.id}`}>{done === playable.length ? "Review chapter" : done ? `Continue — Ex. ${next.number}` : "Start chapter"}</Link>}{playable[0] && <Link className={styles.button} href={`/learning/exercises/${playable[0].id}`}>Start from beginning</Link>}<Link className={styles.button} href={`/learning/chapters/${chapter.id}`}>Open chapter</Link></div>
        <div className={styles.table}><div className={`${styles.row} ${styles.tableHead}`}><span>#</span><span>Exercise</span><span>Status</span><span>Outcome</span></div>{chapter.exercises.map(exercise => {
          const progress = exercise.published?.progress[0]; const outcome = progress?.completedAt ? progress.completionAssisted ? "Assisted" : "Clean" : exercise.published ? progress ? "In progress" : "—" : "Draft";
          const content = <><span>{exercise.number}</span><span>{exercise.title}</span><span><span className={`${styles.dot} ${progress?.completedAt ? progress.completionAssisted ? styles.started : styles.done : progress ? styles.started : ""}`} aria-label={outcome}/></span><span className={styles.meta} style={{ display: "block", margin: 0, color: progress?.completedAt ? progress.completionAssisted ? "var(--status-warn)" : "var(--status-success)" : undefined }}>{outcome}</span></>;
          return exercise.published ? <Link className={styles.row} key={exercise.id} href={`/learning/exercises/${exercise.id}`}>{content}</Link> : <div className={styles.row} key={exercise.id}>{content}</div>;
        })}</div>
        {editable && <><details className={styles.accordion}><summary>Edit chapter</summary><ContentForm kind="chapter" label="Save chapter" initial={{ id: chapter.id, materialId: id, title: chapter.title, order: chapter.order, expectedRevision: chapter.revision }} /></details><Link className={`${styles.button} mt-4`} href={`/learning/new?chapter=${chapter.id}`}>＋ Add exercise</Link></>}
        </div></details>;
    })}</div>
    {editable && <><details className={styles.accordion}><summary>＋ Add chapter</summary><ContentForm kind="chapter" label="Create chapter" initial={{ materialId: id, order: material.chapters.length }} /></details>
      <details id="edit-material" className={styles.accordion}><summary>Edit material</summary><ContentForm kind="material" label="Save material" initial={{ id, title: material.title, edition: material.edition, expectedRevision: material.revision }} /></details></>}
  </main>;
}
