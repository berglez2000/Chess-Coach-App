import "server-only";
import { BookError } from "./pdf";

export const PRIVATE_BOOK_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export function bookJson(data: unknown, status = 200) { return Response.json(data, { status, headers: PRIVATE_BOOK_HEADERS }); }
export function bookFailure(error: unknown) {
  return bookJson({ error: { message: error instanceof BookError ? error.message : "Could not save or load your book. Please try again." } }, error instanceof BookError ? error.status : 500);
}
