import "server-only";
import { OpeningError } from "./content";
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export function openingJson(data: unknown, status = 200) { return Response.json(data, { status, headers: PRIVATE_HEADERS }); }
export function openingFailure(error: unknown) {
  return openingJson({ error: { message: error instanceof OpeningError ? error.message : "Could not load or save your opening. Please try again." } }, error instanceof OpeningError ? error.status : 503);
}
export async function readOpeningJson(request: Request) {
  // Bound even chunked request bodies before parsing.
  if (!request.body) throw new OpeningError("Request body is missing.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 500000) throw new OpeningError("Opening data is too large.", 413); chunks.push(value); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new OpeningError("Opening data must be valid JSON."); }
  } finally { await reader.cancel(); reader.releaseLock(); }
}
