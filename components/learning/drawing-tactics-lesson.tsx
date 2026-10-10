import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/drawing-tactics-lesson.json";

export function DrawingTacticsLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Drawing tactics</summary>
    <p className="mt-4">Tactics can save a lost position as well as win a game. Look for perpetual check, stalemate, or a sacrifice that simplifies into a theoretically drawn ending.</p>
    <p className="mt-3">For stalemate, your king must be out of check and every remaining piece must have no legal move. Sacrificing the last mobile piece can make this possible. For perpetual check, find a repeatable checking pattern and examine the king’s escape squares. Sometimes eliminating a dangerous pawn is enough to reach a familiar drawn ending.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor={example.fen.split(" ")[1] === "b" ? "BLACK" : "WHITE"} positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Drawing tactics, printed page 71. Exercises 469–492: White to move. Book solutions: page 133.</p>
  </details>;
}
