// Personal-server guard: prevent rapid navigation/multiple tabs from flooding Stockfish.
// Cancellation stops the previous search; its slot is released only after process cleanup.
const active = new Set<string>();
export function acquireAnalysis(ownerId: string): (() => void) | null {
  if (active.has(ownerId) || active.size >= 2) return null;
  active.add(ownerId);
  return () => { active.delete(ownerId); };
}
