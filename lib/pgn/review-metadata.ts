/** Standard PGN move-assessment NAGs; chess.com exports these as $1–$6. */
const NAG_SYMBOLS: Record<string, string> = { "1": "!", "2": "?", "3": "!!", "4": "??", "5": "!?", "6": "?!" };

/** Optional display data from the original PGN. Never infer clock values from time control. */
export function pgnReviewMetadata(pgn: string) {
  const tokens = pgn.match(/\[(?:[^"\]]|"[^"]*")*\]|\{[^}]*\}|;[^\r\n]*|[()]|[^\s(){};\[]+/g) ?? [];
  const ratings: { whiteRating?: number; blackRating?: number } = {};
  const headers: Record<string, string> = Object.create(null);
  const clocks: Record<number, number> = {};
  const annotations: Record<number, string> = {};
  const comments: Record<number, string> = {};
  let depth = 0;
  let ply = 0;
  for (const token of tokens) {
    if (token === "(") { depth++; continue; }
    if (token === ")") { depth--; continue; }
    if (depth) continue;
    if (token.startsWith("[")) {
      const header = /^\[([A-Za-z]+)\s+"([^"]*)"\s*\]$/.exec(token);
      if (!ply && header && !Object.hasOwn(headers, header[1])) headers[header[1]] = header[2];
      const rating = /^\[(White|Black)Elo\s+"(\d+)"\s*\]$/.exec(token);
      if (!ply && rating && Number(rating[2]) > 0 && Number.isSafeInteger(Number(rating[2]))) {
        ratings[rating[1] === "White" ? "whiteRating" : "blackRating"] = Number(rating[2]);
      }
      continue;
    }
    if (token.startsWith("{") || token.startsWith(";")) {
      const clock = /\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\s*\]/.exec(token);
      if (ply && clock && Number(clock[2]) < 60 && Number(clock[3]) < 60) {
        const seconds = Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
        if (Number.isFinite(seconds)) clocks[ply] = seconds;
      }
      const text = token.replace(/^\{|\}$|^;/g, "").replace(/\[%[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
      if (ply && text) comments[ply] = comments[ply] ? `${comments[ply]} ${text}` : text;
    } else {
      const nag = /^\$(\d+)$/.exec(token);
      if (nag) {
        if (ply && NAG_SYMBOLS[nag[1]] && !annotations[ply]) annotations[ply] = NAG_SYMBOLS[nag[1]];
        continue;
      }
      const san = token.replace(/^\d+\.(?:\.\.)?/, "").replace(/\$\d+/g, "");
      if (san && !/^(?:\.+|[!?]+|1-0|0-1|1\/2-1\/2|\*)$/.test(san)) {
        ply++;
        const suffix = /[!?]{1,2}$/.exec(san)?.[0];
        if (suffix && Object.values(NAG_SYMBOLS).includes(suffix)) annotations[ply] = suffix;
      } else if (ply && /^[!?]{1,2}$/.test(san) && Object.values(NAG_SYMBOLS).includes(san)) {
        annotations[ply] = san;
      }
    }
  }
  return { ...ratings, headers, clocks, annotations, comments };
}

export interface PgnGameDetails {
  /** Opening name from an Opening header or a chess.com ECOUrl slug. */
  openingName?: string;
  openingUrl?: string;
  /** Link back to the game on the source site (https only). */
  gameUrl?: string;
  sourceSite?: string;
  /** Wall-clock length from StartTime/EndTime headers, in seconds. */
  durationSeconds?: number;
  /** Starting clock and increment from a "base+increment" TimeControl. */
  baseSeconds?: number;
  incrementSeconds?: number;
}

function safeUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch { return undefined; }
}

function utcTimestamp(date: string | undefined, time: string | undefined) {
  if (!date || !time || !/^\d{4}\.\d{2}\.\d{2}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) return undefined;
  const value = Date.parse(`${date.replaceAll(".", "-")}T${time}Z`);
  return Number.isFinite(value) ? value : undefined;
}

/** Extra review context from PGN headers (chess.com, lichess and generic exports). */
export function pgnGameDetails(headers: Record<string, string>): PgnGameDetails {
  const details: PgnGameDetails = {};
  const openingUrl = safeUrl(headers.ECOUrl);
  if (headers.Opening?.trim() && headers.Opening !== "?") details.openingName = headers.Opening.trim();
  else if (openingUrl) {
    const slug = decodeURIComponent(new URL(openingUrl).pathname.split("/").filter(Boolean).pop() ?? "");
    if (slug) details.openingName = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  }
  if (openingUrl) details.openingUrl = openingUrl;
  const gameUrl = safeUrl(headers.Link) ?? safeUrl(headers.Site);
  if (gameUrl) details.gameUrl = gameUrl;
  if (headers.Site?.trim() && headers.Site !== "?" && !safeUrl(headers.Site)) details.sourceSite = headers.Site.trim();
  else if (gameUrl) details.sourceSite = new URL(gameUrl).hostname.replace(/^www\./, "");

  // StartTime/EndTime share one timezone, so their difference is the game length.
  const start = utcTimestamp(headers.Date, headers.StartTime);
  const end = utcTimestamp(headers.EndDate ?? headers.Date, headers.EndTime);
  if (start !== undefined && end !== undefined && end >= start && end - start < 7 * 24 * 3600 * 1000) {
    details.durationSeconds = Math.round((end - start) / 1000);
  }
  const time = headers.TimeControl?.match(/^(\d+)(?:\+(\d+))?$/);
  if (time) {
    details.baseSeconds = Number(time[1]);
    details.incrementSeconds = Number(time[2] ?? 0);
  }
  return details;
}
