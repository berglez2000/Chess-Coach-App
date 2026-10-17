import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/curiosities-lesson.json";

export function CuriositiesLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Curiosities</summary>
    <p className="mt-4">The book’s final chapter brings together surprising tactics, composed problems, and games that ended with a premature resignation. Before giving up, check for forcing moves, quiet threats, unexpected king moves, underpromotion, and stalemate.</p>
    <p className="mt-3">A study asks you to find a win, a material advantage, or a draw. A mating problem asks for checkmate within a specified number of moves, even when the position could be won another way. Use the stated goal to guide your calculation. Tactics should serve a concrete purpose; a sacrifice needs an accurate continuation.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Curiosities, printed page 121. Exercises 979–1001: White to move unless indicated. Book solutions: pages 142–143.</p>
  </details>;
}
