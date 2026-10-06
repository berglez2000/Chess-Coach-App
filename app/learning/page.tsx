import { requireUser } from "@/lib/auth/session";
import styles from "@/components/books/book-library.module.css";
import { BookLibrary } from "@/components/books/book-library";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning | Chess Coach" };
export default async function LearningPage() {
  const user = await requireUser();
  return <main id="main-content" className={styles.page}>
    <BookLibrary key={user.id} ownerId={user.id} />
  </main>;
}
