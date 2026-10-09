import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/discovered-check-lesson.json";

export function DiscoveredCheckLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Discovered check</summary>
    <p className="mt-4">A discovered check happens when a piece moves out of the way of a bishop, rook, or queen, revealing an attack on the enemy king. Because the opponent must answer the check, the moving piece can often capture material on the next turn.</p>
    <p className="mt-3">Look for a blocked line to the enemy king, then find a useful square for the blocking piece. A double check attacks the king with both pieces. A windmill repeats discovered checks to collect several pieces while the king is forced back and forth.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-3">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Discovered check, printed page 39. Exercises 277–300: White to move. Book solutions: pages 128–129.</p>
  </details>;
}
