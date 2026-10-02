import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { booksRepository } from "@/lib/books/repository";
import { BookError, inspectPdf, readPdfUpload } from "@/lib/books/pdf";
import { bookFailure, bookJson } from "@/lib/books/http";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try { return bookJson({ books: await booksRepository(getDb(), user.id).list() }); }
  catch (error) { return bookFailure(error); }
}
export async function POST(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try {
    const name = new URL(request.url).searchParams.get("name")?.trim();
    if (!name || name.length > 200) throw new BookError("Give this book a title of 1–200 characters.");
    if (request.headers.get("content-type")?.split(";")[0] !== "application/pdf") throw new BookError("Choose a PDF file.");
    const pdf = await readPdfUpload(request);
    const { totalPages, thumbnail } = await inspectPdf(pdf);
    return bookJson({ book: await booksRepository(getDb(), user.id).create(name, pdf, totalPages, thumbnail) }, 201);
  } catch (error) { return bookFailure(error); }
}
