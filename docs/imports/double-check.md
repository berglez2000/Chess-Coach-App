# Double check — exercises 301–324

Imported on 2026-10-10 into the existing private material **1001 chess exercises for beginners**. All 24 exercises are published in chapter seven, **Double check**.

Chapter URL: `/learning/chapters/cmv216uyz0000ostqe1d7ioro`.

## Sources and lesson

The user supplied the introduction, all diagrams, and all answers. Positions and source page references were also checked against the saved book PDF (`cmuqvkqsm0006qotqkecscsj9`). Inspected PDF references: introduction page 36 / printed page 43; diagrams pages 37–38 / printed pages 44–45. Answers are on printed page 129.

`data/learning/double-check.json` records the positions, titles, complete book lines, practice lines, and explanations. `data/learning/double-check-lesson.json` contains both teaching diagrams and demonstrations. The introduction explains that double check forces a king move and illustrates a mating bishop move and the defensive reversal `...Nc4+ Nc5+ Kc8 Qh8#`. The second example explicitly starts with Black to move. Both examples use the shared wooden ReplayBoard.

## Practice and validation

The chapter uses the existing SEQUENCE workflow. It validates authored legal continuations rather than claiming exhaustive forced-mate proof against every possible defense. Every supplied main line and sideline was replayed independently, with canonical SAN comparison to verify check/mate suffixes. Every main line contains a position in which two White pieces attack the Black king; tests verify that all legal responses in those positions are king moves. All book mating endings reach checkmate.

The trainer accepts seven half-moves, ending with White, and one deterministic Black reply per prefix. Main lines 308, 313, and 315 exceed this bound. Their practice lines stop after White’s fourth move, and their complete continuations remain in explanations and `bookLines`. Additional book variations remain in the explanations and source file. No castling or en-passant rights were inferred from diagrams.

## Reproduction and checks

```sh
node --conditions=react-server --import tsx scripts/import-double-check.ts MATERIAL_ID
```

The importer validates all complete source lines, confirms each practice line matches the source prefix, and validates the full batch before writing. It requires the existing private beginner book, uses its owner-scoped publication workflow, and refuses conflicting existing answers. A rerun created zero exercises and retained all 24 published entries.

Verification: 83 tests passed across Double check, Discovered check, learning, and solver tests; TypeScript and targeted ESLint passed. Live checks confirmed all 24 published contents match the source. All 300 prior exercise records remained identical when compared by field values. All 29 progress records present before the import, including their attempt histories, remained identical. Four additional progress records appeared during verification; existing learner activity was retained. The importer does not mutate progress records.
