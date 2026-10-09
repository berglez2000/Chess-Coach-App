import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { ENDGAME_CHAPTERS, chapterPositions } from "@/lib/endgames/catalog";
import { PlayWorkspace } from "@/components/play/workspace";
import { SimplePage } from "@/components/ui/simple-page";
import styles from "@/components/books/book-library.module.css";

export default async function EndgamePracticePage({ params }: { params: Promise<{ chapterId: string; positionId: string }> }) {
  await requireUser();
  const { chapterId, positionId } = await params;
  const chapter = ENDGAME_CHAPTERS.find(item => item.id === chapterId);
  const positions = chapterPositions(chapterId);
  const index = positions.findIndex(item => item.id === positionId);
  const position = positions[index];
  if (!chapter || !position) notFound();
  return <SimplePage wide title={position.title} description={position.description}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/endgames">Endgames</Link><span aria-hidden="true">/</span><Link href={`/endgames/${chapter.id}`}>{chapter.title}</Link><span aria-hidden="true">/</span><span aria-current="page">Position {index + 1}</span></nav>
    <PlayWorkspace key={position.id} endgame={position} />
    <nav className={styles.learningLinks} aria-label="Chapter positions"><Link href={`/endgames/${chapter.id}`}>Back to chapter</Link>{positions[index - 1] && <Link href={`/endgames/${chapter.id}/${positions[index - 1].id}`}>Previous position</Link>}{positions[index + 1] && <Link href={`/endgames/${chapter.id}/${positions[index + 1].id}`}>Next position</Link>}</nav>
  </SimplePage>;
}
