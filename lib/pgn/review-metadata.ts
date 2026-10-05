/** Optional display data from the original PGN. Never infer clock values from time control. */
export function pgnReviewMetadata(pgn: string) {
  const tokens = pgn.match(/\[(?:[^"\]]|"[^"]*")*\]|\{[^}]*\}|;[^\r\n]*|[()]|[^\s(){};\[]+/g) ?? [];
  const ratings: { whiteRating?: number; blackRating?: number } = {};
  const clocks: Record<number, number> = {};
  let depth = 0;
  let ply = 0;
  for (const token of tokens) {
    if (token === "(") { depth++; continue; }
    if (token === ")") { depth--; continue; }
    if (depth) continue;
    if (token.startsWith("[")) {
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
    } else {
      const san = token.replace(/^\d+\.(?:\.\.)?/, "").replace(/\$\d+/g, "");
      if (san && !/^(?:\.+|[!?]+|1-0|0-1|1\/2-1\/2|\*)$/.test(san)) ply++;
    }
  }
  return { ...ratings, clocks };
}
