import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/pin-lesson.json";

export function PinLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Pin</summary>
    <p className="mt-4">A pin occurs when a bishop, rook, or queen attacks a piece with a more valuable piece behind it. In an absolute pin, the piece shields its king and cannot move if that would expose check. In a relative pin, it shields another piece, such as a queen, and may legally move.</p>
    <p className="mt-3">Use a pin to win material by adding another attacker, or to deliver mate when a pinned defender cannot capture. Always check the opponent’s forcing replies: a relative pin can be broken, and even an absolute pin can be neutralised by attacking the pinning piece.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Pin, printed pages 47–48. Exercises 325–360: White to move. Book solutions: pages 129–130.</p>
  </details>;
}
