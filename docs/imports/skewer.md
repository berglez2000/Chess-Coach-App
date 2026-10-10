# Skewer — exercises 361–384

Imported and published on 2026-10-10 in the existing private material **1001 chess exercises for beginners**, as chapter nine, **Skewer**.

Chapter URL: `/learning/chapters/cmv295s6z00007btqjubth4fr`.

The user supplied the introduction, 24 diagrams, and solutions. The saved book PDF (`cmuqvkqsm0006qotqkecscsj9`) was also inspected: introduction PDF page 44 / printed page 53; exercise PDF pages 45–46 / printed pages 54–55; answer PDF page 111 / printed page 130. References are recorded in `data/learning/skewer.json`.

The introduction explains skewers by bishops, rooks, and queens, preparing alignment with checks, sacrifices, and promotion, and examining defensive resources. Both teaching diagrams use the shared wooden ReplayBoard. The second diagram shows the position after Bg2+, so it explicitly starts with Black to move; its demonstration shows why Bxb7 loses to Ra5 mate.

Every complete main line, source sideline, and cautionary line was replayed with canonical SAN comparison, including check/mate suffixes. Exercise 370 retains the complete seven-half-move sideline with the quiet Rd8 before ...Kg8 and Rxe8+. Exercises 380 and 381 exceed the trainer's seven-half-move limit; their practice stops after White's fourth move and their complete continuations remain in explanations and `bookLines`. Source warnings for 369 and 376 remain in explanations and validated `analysisLines`. Sidelines are preserved as source commentary; practice uses one deterministic Black reply per prefix. No castling or en-passant rights were inferred from diagrams.

The chapter uses the existing SEQUENCE workflow, validating authored legal continuations rather than claiming exhaustive forced-mate or material-gain proof. Tests additionally verify the pinned knight in 366, unpinning before promotion in 372, and the introduction's defensive mating reply.

Reproduce with:

```sh
node --conditions=react-server --import tsx scripts/import-skewer.ts cmusdjfpn00008ququn4kk6n7
```

The importer validates the whole batch before writing, requires the existing private beginner book, and refuses conflicting existing answers. A rerun created zero exercises. Live checks confirmed all 24 published answer identities match the source.

Verification: 85 tests passed across Skewer, Pin, and learning; TypeScript and targeted ESLint passed. Live database checks confirmed all 360 prior exercise records, 36 prior progress records, and 76 prior attempt records remained unchanged.
