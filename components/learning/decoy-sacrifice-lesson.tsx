import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/decoy-sacrifice-lesson.json";

export function DecoySacrificeLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Decoy sacrifice</summary>
    <p className="mt-4">A decoy sacrifice draws an opponent’s piece onto a critical square. Once there, it becomes vulnerable to checkmate or a tactic that wins material.</p>
    <p className="mt-3">Look for a square where the king or another piece could be forked, pinned, or skewered. Then find a forcing sacrifice that brings it there. Some combinations need a preliminary sacrifice to clear a square before the decoy works.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Decoy sacrifice, printed page 60. Exercises 409–432: White to move. Book solutions: pages 131–132.</p>
  </details>;
}
