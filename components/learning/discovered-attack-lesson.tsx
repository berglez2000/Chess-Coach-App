import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/discovered-attack-lesson.json";

export function DiscoveredAttackLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Discovered attack</summary>
    <p className="mt-4">A discovered attack happens when one piece moves out of the way of a bishop, rook, or queen, revealing an attack by that second piece. The moving piece can create its own threat at the same time, producing a double attack.</p>
    <p className="mt-3">Look along blocked files, ranks, and diagonals. Choose a move that creates a threat strong enough to give the uncovered attack time to work. Then check whether your opponent has a check, a mating threat, or a move that saves both targets.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Discovered attack, printed page 35. Exercises 253–276: White to move. Book solutions: page 128.</p>
  </details>;
}
