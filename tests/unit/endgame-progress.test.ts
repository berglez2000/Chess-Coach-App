import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { applyEndgameSnapshot, EMPTY_ENDGAME_PROGRESS, endgameVersion, type EndgameSnapshot } from "@/lib/endgames/progress";
import { ENDGAMES } from "@/lib/endgames/catalog";
const position = { ...ENDGAMES[0], fen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1" };
const initial = (): EndgameSnapshot => ({ sessionId: randomUUID(), difficulty: "casual", moves: [], resigned: false, hintUsed: false, analysisUsed: false });
it("validates legal histories, terminal boundaries, and server-derived completion", () => {
  const snapshot = initial(); const start = applyEndgameSnapshot(position, EMPTY_ENDGAME_PROGRESS, snapshot);
  expect(start.attempts).toBe(1); expect(start.completedAt).toBeNull();
  const completed = applyEndgameSnapshot(position, start, { ...snapshot, moves: ["g6g7"] });
  expect(completed.completedAt).not.toBeNull(); expect(completed.completionAssisted).toBe(false);
  expect(() => applyEndgameSnapshot(position, completed, { ...snapshot, moves: ["g6g7", "h8h7"] })).toThrow();
  expect(() => applyEndgameSnapshot(position, start, { ...snapshot, moves: ["g6f4"] })).toThrow();
  expect(() => applyEndgameSnapshot(position, EMPTY_ENDGAME_PROGRESS, { ...snapshot, moves: ["g6g7"] })).toThrow();
});
it("keeps assistance sticky and first completion across restarts", () => {
  const snapshot = initial(); const start = applyEndgameSnapshot(position, EMPTY_ENDGAME_PROGRESS, { ...snapshot, analysisUsed: true });
  const completed = applyEndgameSnapshot(position, start, { ...snapshot, moves: ["g6g7"] });
  expect(completed.completionAssisted).toBe(true);
  const restart = applyEndgameSnapshot(position, completed, initial());
  expect(restart.attempts).toBe(2); expect(restart.completedAt).toBe(completed.completedAt); expect(restart.completionAssisted).toBe(true);
});
it("rejects rewrites and resignation continuation and distinguishes draw/mate/winner", () => {
  const snapshot = initial(); const start = applyEndgameSnapshot(position, EMPTY_ENDGAME_PROGRESS, snapshot);
  const resigned = applyEndgameSnapshot(position, start, { ...snapshot, resigned: true });
  expect(resigned.completedAt).toBeNull();
  expect(() => applyEndgameSnapshot(position, resigned, snapshot)).toThrow();
  expect(() => applyEndgameSnapshot(position, resigned, { ...snapshot, resigned: true, moves: ["g6g7"] })).toThrow();
  expect(() => applyEndgameSnapshot(position, start, { ...snapshot, difficulty: "strong" })).toThrow();
  const draw = { ...position, objective: "draw" as const };
  expect(applyEndgameSnapshot(draw, start, { ...snapshot, moves: ["g6f7"] }).completedAt).not.toBeNull();
  expect(applyEndgameSnapshot(position, start, { ...snapshot, moves: ["g6f7"] }).completedAt).toBeNull();
  expect(applyEndgameSnapshot({ ...position, color: "BLACK" }, start, { ...snapshot, moves: ["g6g7"] }).completedAt).toBeNull();
});
it("changes the progress version only for answer-changing edits", () => {
  expect(endgameVersion(position)).toBe(endgameVersion({ ...position, hint: "New hint" }));
  expect(endgameVersion(position)).not.toBe(endgameVersion({ ...position, objective: "draw" }));
});
