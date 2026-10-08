export class EngineError extends Error {
  constructor(public readonly code: "CONFIG" | "INVALID_FEN" | "UNAVAILABLE" | "EXITED" | "TIMEOUT" | "PROTOCOL" | "CANCELLED", message: string) {
    super(message);
    this.name = "EngineError";
  }
}
