import { ReplayBoard } from "@/components/chess/replay-board";
import examples from "@/data/learning/promotion-lesson.json";

export function PromotionLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Promotion</summary>
    <p className="mt-4">A pawn reaching the last rank can become a queen, rook, bishop, or knight. Promotion tactics include sacrifices that clear its path, threats that win material, and underpromotions that avoid stalemate or give a decisive check.</p>
    <p className="mt-3">In pawn endings, use the rule of the square to judge whether a king can catch a passed pawn. Check whether another pawn or piece blocks the king’s route. Before promoting, compare all four pieces and check the opponent’s forcing replies.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor={example.fen.split(" ")[1] === "b" ? "BLACK" : "WHITE"} positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Promotion, printed pages 63–64. Exercises 433–468: White to move. Book solutions: page 132.</p>
  </details>;
}
