import { getDb } from "@/lib/db/client";
import { listEndgameProgress } from "@/lib/endgames/repository";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { ENDGAME_CHAPTERS } from "@/lib/endgames/catalog";
import { EndgameChapter } from "@/components/endgames/library";
import styles from "@/components/books/book-library.module.css";

export default async function EndgameChapterPage({ params, searchParams }: { params: Promise<{ chapterId: string }>; searchParams?: Promise<{ page?: string; group?: string }> }) {
  const user = await requireUser();
  const { chapterId } = await params;
  const query = await searchParams;
  const chapter = ENDGAME_CHAPTERS.find(item => item.id === chapterId);
  if (!chapter) notFound();
  return <main id="main-content" className={styles.page}><EndgameChapter progress={await listEndgameProgress(getDb(), user.id)} chapter={chapter} page={Number(query?.page ?? 1)} group={query?.group} /></main>;
}
