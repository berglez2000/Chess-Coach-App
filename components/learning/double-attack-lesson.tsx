import { ReplayBoard } from "@/components/chess/replay-board";

const examples = [
  {
    title: "One piece, two targets",
    fen: "6k1/8/8/1b1R1n2/8/8/8/4K3 b - - 0 1",
    text: "White has played Rd5. The rook attacks the bishop on b5 and knight on f5. Moving one piece normally leaves the other available for capture.",
  },
  {
    title: "A defender can save both pieces",
    fen: "6k1/8/3P4/1b1R1n2/8/8/8/4K3 b - - 0 1",
    text: "With a white pawn on d6, Black can answer ...Bd7. The bishop escapes the rook’s attack and protects the knight on f5. Check whether either target can move to defend the other.",
  },
  {
    title: "Combine a mate threat with an attack",
    fen: "r1bq1rk1/p1pnbppp/1p2p3/8/3P4/2NB4/PPP1QPPP/R1B1K2R w - - 0 1",
    text: "Qe4 threatens Qxh7 mate and attacks the rook on a8 along the diagonal. Black must address the threat to the king, giving White time to take the rook. This is a double threat: the two objectives need not both be captures.",
  },
  {
    title: "Check the opponent’s counterattack",
    fen: "6k1/8/8/1b1R1n2/8/8/6K1/8 b - - 0 1",
    text: "Here the white king is on g2. Black can play ...Bc6, pinning the rook to the king, or ...Ne3+, checking the king and attacking the rook. Before creating a double attack, look for your opponent’s checks, pins, and forks.",
  },
  {
    title: "A pawn fork",
    fen: "6k1/5pp1/8/1p1r1r2/8/1R5P/4P1PK/1R6 w - - 0 1",
    text: "White plays e4, attacking both rooks on d5 and f5. A double attack by a pawn or knight is usually called a fork. Every piece, including the king, can create a double attack.",
  },
];

export function DoubleAttackLesson() {
  return <details className="mt-6 rounded-xl border bg-white p-4" open>
    <summary className="cursor-pointer text-lg font-semibold">Study: Double attack</summary>
    <p className="mt-4">Winning material makes checkmate easier. A double attack creates two threats at once, often against undefended pieces. If the opponent can meet only one threat, you gain material on the next move.</p>
    <p className="mt-3">Look for loose pieces and vulnerable kings. Knights are especially effective because their attacks can be difficult to anticipate. Always check whether the opponent can defend both targets or create a stronger threat.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {examples.map(example => <section key={example.title}>
        <h2 className="mb-3 font-semibold">{example.title}</h2>
        <div className="mx-auto w-full max-w-[300px]"><ReplayBoard fen={example.fen} userColor="WHITE" positionLabel={example.title} /></div>
        <p className="mt-3 text-sm">{example.text}</p>
      </section>)}
    </div>
    <p className="mt-5 text-sm text-gray-600">Adapted from 1001 chess exercises for beginners, Double attack, printed pages 29–30. Exercises 217–252: White to move. Book solutions: pages 127–128.</p>
  </details>;
}
