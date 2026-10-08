import "server-only";
import { z } from "zod";
import { importPgn, OpeningError } from "./content";

const requestSchema = z.object({ url: z.string().trim().max(2048), startFen: z.string().max(200) }).strict();
const MAX_BYTES = 250000;

/** Restrict outbound requests to public PGN hosts, including every redirect. */
export function pgnSourceUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new OpeningError("Enter a valid HTTPS source URL."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new OpeningError("Use a public HTTPS source URL.");
  url.hash = "";
  if (url.hostname === "lichess.org") {
    const study = url.pathname.match(/^\/study\/([a-zA-Z0-9]{8})(?:\/([a-zA-Z0-9]{8}))?(?:\.pgn)?\/?$/);
    if (!study) throw new OpeningError("Use a public Lichess study URL.");
    // Import the whole study even when the pasted URL selects a chapter.
    return new URL(`https://lichess.org/study/${study[1]}.pgn`);
  }
  if (["raw.githubusercontent.com", "gist.githubusercontent.com"].includes(url.hostname)) return url;
  throw new OpeningError("Supported sources: public Lichess studies and raw GitHub or Gist PGN URLs.");
}

export async function importOpeningUrl(input: unknown) {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new OpeningError("Provide a source URL and starting FEN.");
  let url = pgnSourceUrl(parsed.data.url);
  const signal = AbortSignal.timeout(15000);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetch(url, { signal, redirect: "manual", cache: "no-store", headers: { Accept: "application/x-chess-pgn, text/plain" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new OpeningError("The source redirected too many times.");
        url = pgnSourceUrl(new URL(location, url).href);
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new OpeningError("Could not download the PGN. Check that the source is public.", 502); }
      if (!response.body) throw new OpeningError("The source returned an empty PGN.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_BYTES) throw new OpeningError("The source PGN exceeds 250 KB.", 413);
          chunks.push(value);
        }
      } finally { await reader.cancel(); reader.releaseLock(); }
      const pgn = Buffer.concat(chunks).toString("utf8");
      if (/^\s*(?:<!doctype|<html)/i.test(pgn)) throw new OpeningError("The source returned a web page. Use a public study or a raw PGN URL.");
      return { lines: importPgn(pgn, parsed.data.startFen), sourceUrl: url.href };
    }
  } catch (error) {
    if (error instanceof OpeningError) throw error;
    throw new OpeningError("Could not download the PGN. Check the URL and try again.", 502);
  }
  throw new OpeningError("Could not download the PGN.", 502);
}
