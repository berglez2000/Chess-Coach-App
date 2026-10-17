# Curiosities

Final chapter of **1001 chess exercises for beginners**, containing all 23 exercises **979–1001** after “Mate in 4” (chapter order 17).

Source: user-supplied `chess-exercises-103.png`–`chess-exercises-105.png` (printed pages 121–123) and `chess-exercises-123.png`–`chess-exercises-124.png` (solutions, printed pages 142–143), supplied on 2026-10-17.

Positions, titles, complete book continuations, cautionary variations, explanations, and PDF page references are retained in `data/learning/curiosities.json`. The introduction and Sam Loyd’s 1859 problem use the shared wooden `ReplayBoard`.

Exercise 979 is exhaustively verified as mate in two. The remaining exercises use the existing authored-sequence trainer to accommodate material wins, longer mates, quiet threats, underpromotion, and the stalemate in 989. Practice uses up to four solver moves; full continuations remain in explanations. These sequences are checked for legal moves, rather than presented as exhaustive engine proofs of every winning or drawing claim.

Source details:

- Black moves in 981, 985, 990, and 995, including the winning resource Black missed before resigning in 995.
- Exercise 979 prints `...gxf6`, which is impossible from the supplied diagram. The correction `...gxf4` permits the stated `Rc6#` and is explicitly documented in the exercise explanation.
- Exercise 984’s inconsistent printed move numbers are normalized; `Qxc5+` remains a check rather than an immediate mate.
- Knight promotion in 982, all three black knights and the final stalemate in 989, Marshall’s queen sacrifice in 990, and the final pawn forks with mate in 1001 are preserved.
- Unsuccessful alternatives in 995, 996, 997, and 999 are kept separately as analysis lines, with their context in the explanations.

Verification and import:

```sh
npx vitest run tests/unit/curiosities.test.ts tests/unit/puzzle-sequences.test.ts tests/unit/learning-profile.test.ts
npm run typecheck
node --conditions=react-server --import tsx scripts/import-curiosities.ts cmusdjfpn00008ququn4kk6n7
```

The importer validates all content and complete source continuations before writing. Identical reruns preserve exercise IDs and progress; conflicting answers stop the import for review.

Import result — 2026-10-17: all 23 exercises created and published in the existing private book. Chapter ID: `cmvc31chg0000ogtquds04wen`. Route: `/learning/chapters/cmvc31chg0000ogtquds04wen`.

All 49 relevant tests, TypeScript checking, and targeted ESLint checking passed.
