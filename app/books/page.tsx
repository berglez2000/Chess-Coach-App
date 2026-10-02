import { requireUser } from "@/lib/auth/session";
import { BookLibrary } from "@/components/books/book-library";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your books | Chess Coach" };
export default async function BooksPage() {
  const user = await requireUser();
  return <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
    <BookLibrary key={user.id} ownerId={user.id} />
  </main>;
}
