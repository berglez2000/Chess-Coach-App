import { getDb } from "@/lib/db/client";
import { listEndgameProgress } from "@/lib/endgames/repository";
import { requireUser } from "@/lib/auth/session";
import { EndgameLibrary } from "@/components/endgames/library";
import styles from "@/components/books/book-library.module.css";

export const metadata = { title: "Endgames | Chess Coach" };
export default async function EndgamesPage() {
  const user = await requireUser();
  return <main id="main-content" className={styles.page}><EndgameLibrary progress={await listEndgameProgress(getDb(), user.id)} /></main>;
}
