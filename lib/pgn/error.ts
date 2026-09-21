export type PgnErrorCode =
  | "EMPTY_PGN"
  | "INVALID_PGN"
  | "ILLEGAL_MOVE"
  | "UNSUPPORTED_PGN"
  | "MULTIPLE_GAMES";

export class PgnParseError extends Error {
  constructor(public readonly code: PgnErrorCode, message: string) {
    super(message);
    this.name = "PgnParseError";
  }
}
