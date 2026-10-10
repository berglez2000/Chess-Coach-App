# Deflection — exercises 385–408

Imported and published on 2026-10-10 in the existing private material **1001 chess exercises for beginners**, as chapter ten, **Deflection**.

Chapter URL: `/learning/chapters/cmv29s0ru00005btqet2hxphl`.

The user supplied the introduction, 24 diagrams, and solutions. The saved book PDF (`cmuqvkqsm0006qotqkecscsj9`) was also inspected: introduction PDF page 47 / printed page 57; exercise PDF pages 48–49 / printed pages 58–59; answer PDF page 112 / printed page 131. References are recorded in `data/learning/deflection.json`.

The introduction explains forcing a defender away from a piece or key square, combinations with pins, and overloaded defenders. Both teaching diagrams use the shared wooden ReplayBoard. Their demonstrations and consistent source variations are independently replayed in tests.

## Source details

The second introductory diagram already has a white pawn on f4. Its optional printed continuation `...Qe5+ f4` is inconsistent: that pawn blocks the stated check and cannot play f4 again. The valid main combination and queen sidelines are retained; the inconsistent continuation is documented in the lesson data's `sourceNote` and omitted from playable demonstrations. The book's `R3xg8+` is represented by canonical SAN `Rgxg8+`. A legal illustrative defense `...Qg7 Qxg7#` completes the source's `...Qc7 Qf6+` mating threat.

Every complete exercise main line, source sideline, and cautionary line was replayed with canonical SAN comparison, including check/mate suffixes. Exercise 389 retains the source's short `Qf7 Rxf7 Rc8+` sideline; the book leaves the later mate unspecified. Exercise 399's inconsistent printed move numbering is normalised to the legal SAN sequence `Qxe6 fxe6 f7 Qb1+ Kh2`. Source warnings for 392, 400, and 404 remain in explanations and validated `analysisLines`.

All main practice lines fit within the trainer's seven-half-move limit. Sidelines are preserved as source commentary; practice uses one deterministic Black reply per prefix. No castling or en-passant rights were inferred from diagrams.

The chapter uses the existing SEQUENCE workflow, validating authored legal continuations rather than claiming exhaustive forced-mate or material-gain proof. Tests additionally verify the deflected knight in 386, the correct rook sacrifice in 392, and the deflected pawn in 406.

## Reproduction and checks

```sh
node --conditions=react-server --import tsx scripts/import-deflection.ts cmusdjfpn00008ququn4kk6n7
```

The importer validates the whole batch before writing, requires the existing private beginner book, and refuses conflicting existing answers. A rerun created zero exercises. Live checks confirmed all 24 published answer identities match the source.

Verification: 70 tests passed across Deflection, Skewer, and learning; TypeScript and targeted ESLint passed. Live database checks confirmed all 384 prior exercise records, 36 prior progress records, and 76 prior attempt records remained unchanged.
