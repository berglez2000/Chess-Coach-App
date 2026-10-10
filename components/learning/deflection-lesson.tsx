import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/deflection-lesson.json";

export function DeflectionLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Deflection</summary>
    <p className="mt-4">Deflection forces a defending piece away from a piece or a key square. A sacrifice often makes the defender abandon one task to answer a check or capture an offered piece, allowing mate, promotion, or a material gain.</p>
    <p className="mt-3">First identify the defender and what it protects. Then look for a forcing move that draws it away. Deflection often combines with pins and double attacks. A piece is overloaded when it has more defensive tasks than it can handle.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Deflection, printed page 57. Exercises 385–408: White to move. Book solutions: page 131.</p>
  </details>;
}
