export class EngineError extends Error {
  constructor(public readonly code: "CONFIG" | "INVALID_FEN" | "UNAVAILABLE" | "EXITED" | "TIMEOUT" | "PROTOCOL", message: string) {
    super(message);
    this.name = "EngineError";
  }
}
