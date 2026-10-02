import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { booksRepository } from "@/lib/books/repository";
import { BookError } from "@/lib/books/pdf";
import { bookFailure, PRIVATE_BOOK_HEADERS } from "@/lib/books/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try {
    const data = await booksRepository(getDb(), user.id).file((await params).id, true);
    if (!data) throw new BookError("Thumbnail not found.", 404);
    return new Response(new Uint8Array(data), { headers: { ...PRIVATE_BOOK_HEADERS, "Content-Type": "image/png" } });
  } catch (error) { return bookFailure(error); }
}
