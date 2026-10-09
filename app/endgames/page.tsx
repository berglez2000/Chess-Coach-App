import { requireUser } from "@/lib/auth/session";
import { EndgameLibrary } from "@/components/endgames/library";
import styles from "@/components/books/book-library.module.css";

export const metadata = { title: "Endgames | Chess Coach" };
export default async function EndgamesPage() {
  await requireUser();
  return <main id="main-content" className={styles.page}><EndgameLibrary /></main>;
}
