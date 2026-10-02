import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { booksRepository } from "@/lib/books/repository";
import { bookActionSchema } from "@/lib/books/contract";
import { BookError } from "@/lib/books/pdf";
import { bookFailure, bookJson } from "@/lib/books/http";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try {
    const book = await booksRepository(getDb(), user.id).get((await context.params).id);
    if (!book) throw new BookError("Book not found.", 404);
    return bookJson({ book });
  } catch (error) { return bookFailure(error); }
}
export async function PATCH(request: Request, context: Context) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try {
    let input: unknown;
    try { input = await request.json(); } catch { throw new BookError("Send a valid reader update."); }
    const result = bookActionSchema.safeParse(input);
    if (!result.success) throw new BookError("Send a valid page or checkmark update.");
    return bookJson({ book: await booksRepository(getDb(), user.id).change((await context.params).id, result.data) });
  } catch (error) { return bookFailure(error); }
}
export async function DELETE(request: Request, context: Context) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try {
    if (!await booksRepository(getDb(), user.id).remove((await context.params).id)) throw new BookError("Book not found.", 404);
    return bookJson({ removed: true });
  } catch (error) { return bookFailure(error); }
}
