import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/double-check-lesson.json";

export function DoubleCheckLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Double check</summary>
    <p className="mt-4">A double check is a discovered check in which the moving piece also checks the king. Two pieces attack the king at once, leaving the defender with only king moves.</p>
    <p className="mt-3">Blocking one checking line or capturing a checker with another piece cannot answer both checks. Look for a sacrifice that draws the king onto a square where you can give double check, then examine its escape squares.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Double check, printed page 43. Exercises 301–324: White to move. Book solutions: page 129.</p>
  </details>;
}
