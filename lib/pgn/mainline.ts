import { PgnParseError } from "./error";

/** Strip comments/RAVs only for boundary checks; chess.js still parses the PGN. */
export function mainlineText(pgn: string): string {
  let depth = 0;
  let braceComment = false;
  let lineComment = false;
  let quoted = false;
  let inTag = false;
  let output = "";

  for (const char of pgn) {
    if (lineComment) {
      if (char === "\n" || char === "\r") lineComment = false;
      else continue;
    }
    if (braceComment) {
      if (char === "}") braceComment = false;
      continue;
    }
    if (inTag) {
      if (char === '"') quoted = !quoted;
      if (char === "]" && !quoted) inTag = false;
      if (depth === 0) output += char;
      continue;
    }
    if (char === "{" || char === ";") {
      braceComment = char === "{";
      lineComment = char === ";";
      output += " ";
    } else if (char === "(") {
      depth++;
      output += " ";
    } else if (char === ")") {
      if (--depth < 0) throw new PgnParseError("INVALID_PGN", "PGN has an unmatched variation bracket.");
    } else if (char === "[") {
      inTag = true;
      if (depth === 0) output += char;
    } else if (depth === 0) {
      output += char;
    }
  }
  if (depth || braceComment || inTag) {
    throw new PgnParseError("INVALID_PGN", "PGN has an unfinished comment, header, or variation.");
  }
  return output;
}
