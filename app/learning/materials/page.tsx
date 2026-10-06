import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { library } from "@/lib/learning/repository";
import { ContentForm } from "@/components/learning/content-form";
import styles from "@/components/learning/learning.module.css";
import { LearningProgress } from "@/components/learning/progress";
import { Icon, type IconName } from "@/components/ui/icon";
const quickLinks: { href: string; title: string; description: string; icon: IconName }[] = [
  { href: "/learning/history", title: "Exercise history", description: "See your past answers and revisions", icon: "games" },
  { href: "/learning/profile", title: "Learning profile", description: "Goals, weaknesses, and study habits", icon: "profile" },
  { href: "/learning/plan", title: "Weekly plan", description: "Your AI-generated study schedule", icon: "plan" },
];
export const dynamic = "force-dynamic";
export const metadata = { title: "Learning library | Chess Coach" };
export default async function LearningPage() {
  const user = await requireUser(); const materials = await library(getDb(), user.id);
  const all = materials.flatMap(m => m.chapters.flatMap(c => c.exercises)).filter(e => e.published);
  const completed = all.filter(e => e.published?.progress[0]?.completedAt);
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const inProgress = materials.filter(m => { const exercises = m.chapters.flatMap(c => c.exercises).filter(e => e.published); return exercises.some(e => e.published?.progress.length) && exercises.some(e => !e.published?.progress[0]?.completedAt); }).length;
  return <main id="main-content" className={styles.page}>
    <h1>Learning library</h1><p className={styles.subtitle}>Study books by chapter and practice their exercises. Your exercise progress is saved separately from PDF reading progress.</p>
    <nav className={styles.links}>{quickLinks.map(link => <Link key={link.href} href={link.href}>{link.title}</Link>)}</nav>
    <div className={styles.layout}><section><div className={styles.heading}><h2>Your materials</h2><a href="#create-material" className={styles.primary}>＋ New material</a></div>
      <div className={styles.list}>{!materials.length && <p className={styles.subtitle}>No learning materials yet. Create a material or add the supplied Mate in One sample.</p>}
      {materials.map(material => { const exercises = material.chapters.flatMap(c => c.exercises).filter(e => e.published); const count = exercises.filter(e => e.published?.progress[0]?.completedAt).length;
        return <article key={material.id} className={styles.card}><div className={styles.cardTop}><span className={styles.icon}><Icon name="books" size={22}/></span><div><div className={styles.titleRow}><h2><Link href={`/learning/${material.id}`}>{material.title}</Link></h2><span className={`${styles.badge} ${material.shared ? styles.shared : ""}`}>{material.shared ? "Shared" : "Private"}</span></div><p className={styles.meta}><span>{material.chapters.length} chapters</span><span>{exercises.length} exercises</span>{material.shared && <span>Read-only</span>}</p></div></div>
        <LearningProgress completed={count} total={exercises.length}/><div className={styles.pills}>{material.chapters.map(chapter => { const playable = chapter.exercises.filter(e => e.published); const done = playable.filter(e => e.published?.progress[0]?.completedAt).length; return <Link key={chapter.id} href={`/learning/${material.id}#chapter-${chapter.id}`} className={styles.pill}><span className={`${styles.dot} ${done && done === playable.length ? styles.done : playable.some(e => e.published?.progress.length) ? styles.started : ""}`}/>{chapter.title} — {done}/{playable.length}</Link>; })}</div>
        <div className={styles.actions}><Link className={styles.primary} href={`/learning/${material.id}`}>{count === exercises.length && count > 0 ? "Review" : "Continue"}</Link>{!material.shared && material.ownerId === user.id && <Link className={styles.button} href={`/learning/${material.id}#edit-material`}>Edit</Link>}</div></article>;
      })}
      <details id="create-material" className={styles.create}><summary>＋ Create a new material<span>Organize your exercises into chapters, add diagrams, and track your progress.</span></summary><ContentForm kind="material" label="Create private material" /></details></div>
    </section><aside className={styles.aside}><section className={styles.card}><h2>Your progress</h2><div className={styles.stat}><strong>{completed.filter(e => new Date(e.published!.progress[0].completedAt!) >= weekStart).length}</strong><span>current exercises completed this week</span></div><div className={styles.stat}><strong>{completed.length}</strong><span>current exercises completed</span></div><div className={styles.stat}><strong>{inProgress}</strong><span>materials in progress</span></div></section>
    <section className={styles.card}><h2>Quick access</h2>{quickLinks.map(link => <Link className={styles.quick} key={link.href} href={link.href}><span className={styles.icon}><Icon name={link.icon}/></span><span><strong>{link.title}</strong><small>{link.description}</small></span></Link>)}</section>
    <section className={styles.sample}><h2>Try a sample exercise</h2><p>Add a Mate in One sample to explore the exercise practice workflow before creating your own material.</p><ContentForm kind="sample" label="Add Mate in One sample" /></section></aside></div>
  </main>;
}
