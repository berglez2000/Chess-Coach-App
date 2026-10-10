import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/skewer-lesson.json";

export function SkewerLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Skewer</summary>
    <p className="mt-4">A skewer attacks two pieces on the same line. When the more valuable piece in front moves out of the attack, the piece behind it becomes exposed. Bishops, rooks, and queens can create skewers along their lines of movement.</p>
    <p className="mt-3">Look for checks that force a king away from a queen or rook behind it. A sacrifice, pawn move, or promotion may first bring the targets into alignment. Before collecting the second piece, examine the opponent’s checks and mating threats.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Skewer, printed page 53. Exercises 361–384: White to move. Book solutions: page 130.</p>
  </details>;
}
