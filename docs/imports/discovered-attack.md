# Discovered attack — exercises 253–276

Imported on 2026-10-09 into the existing private material **1001 chess exercises for beginners**. All 24 exercises are published in chapter five, **Discovered attack**.

Chapter URL: `/learning/chapters/cmv1efzh70000m1tqachry3n8`.

## Sources and lesson

The user supplied the introduction, all 24 diagrams, and all corresponding solutions. Positions were also checked against the book PDF already saved in the app (`cmuqvkqsm0006qotqkecscsj9`). Inspected source references: introduction PDF page 30 / printed page 35; diagrams PDF pages 31–32 / printed pages 36–37; solutions PDF page 109 / printed page 128. Each diagram page contains twelve exercises.

`data/learning/discovered-attack.json` stores positions, source references, practice solutions, complete book lines, and explanations. `data/learning/discovered-attack-lesson.json` stores the two introduction positions and legal demonstration lines. The chapter page includes a paraphrased explanation of the motif and the defensive counterexample, using the shared wooden ReplayBoard.

## Solutions and practice

All practice solutions use the existing SEQUENCE workflow. Its validator checks legal authored sequences; this import does not claim exhaustive proof of every material-gain assertion or acceptance of all equally strong alternatives.

The existing trainer permits seven half-moves ending with White and one deterministic Black reply per prefix. Main lines 265 and 268 exceed that bound, so practice uses their first seven half-moves and preserves the full continuation in the explanation. Every book sideline is also preserved in the explanation and `bookLines`, including the longer nine-half-move variation of 270, and 276’s simpler alternative. The cautionary line in 269 is preserved and independently checked.

Moves use canonical SAN checked against the exact positions, including check/mate suffixes. In particular, 253’s mating move is Qxh7#, 255’s Kb6 is Kb6+ (its initial Rc8 is not check), and 267’s final rook capture is unambiguously Rxg7. Exercise 270’s sideline uses Bxc7+ by the bishop originally on d6. No castling or en-passant rights were inferred from the diagrams. Printed move numbers and annotations such as `!` are excluded from machine-readable SAN.

## Reproduction and verification

```sh
node --conditions=react-server --import tsx scripts/import-discovered-attack.ts MATERIAL_ID
```

The importer checks every full book line against canonical SAN and validates all practice rows before database writes. It selects the existing private beginner book, uses the owner-scoped publication workflow, and refuses conflicting existing answers. Rerunning the import created zero exercises and retained all 24 published entries.

Validation: 94 tests passed across the new chapter tests and existing Double attack, learning, and solver tests. TypeScript and targeted ESLint passed after final edits. The 29 new chapter tests check source coverage, all complete book lines, exact SAN suffixes, mating endings, practice truncation, both lesson demonstrations, and the cautionary line in 269.

Live verification compared all 24 published contents with the source file. All 252 earlier exercise IDs, revisions, publication IDs, and statuses remained identical. Existing learner progress and attempt history were compared before and after and remained identical.
