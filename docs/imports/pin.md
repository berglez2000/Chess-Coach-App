# Pin — exercises 325–360

Imported and published on 2026-10-10 in the existing private material **1001 chess exercises for beginners**, as chapter eight, **Pin**.

Chapter URL: `/learning/chapters/cmv222w2u0000xytq6toph2kp`.

The user supplied the introduction, 36 diagrams, and solutions. The saved book PDF (`cmuqvkqsm0006qotqkecscsj9`) was also inspected: introduction PDF pages 39–40 / printed pages 47–48; exercise PDF pages 41–43 / printed pages 49–51; answer PDF pages 110–111 / printed pages 129–130. These references are recorded in `data/learning/pin.json`.

The study introduction explains absolute and relative pins, adding pressure, pinned defenders, counter-pins, breaking relative pins, and active unpinning. All five source teaching diagrams use the shared wooden ReplayBoard. Their demonstrations are retained in `data/learning/pin-lesson.json` and independently checked for legal moves.

All main lines and source sidelines were replayed with canonical SAN comparison, including check/mate suffixes. Exercise 341 uses canonical `Rc8` for the book's redundant `Rac8`: the c5 rook is absolutely pinned, so only the a8 rook can move to c8. Exercises 341, 354, and 356 exceed the trainer's seven-half-move limit; their practice stops after White's fourth move and the complete continuations remain in explanations and `bookLines`. Sidelines are preserved as source commentary; practice uses one deterministic Black reply per prefix. No castling or en-passant rights were inferred from the diagrams.

The chapter uses the existing SEQUENCE workflow, validating authored legal continuations rather than claiming exhaustive forced-mate or material-gain proof. Tests also check the illegal en-passant defense in 328, the queen pin in 336, and breaking a relative pin in 348.

Reproduce with:

```sh
node --conditions=react-server --import tsx scripts/import-pin.ts cmusdjfpn00008ququn4kk6n7
```

The importer validates the whole batch before writing, requires the existing private beginner book, and preserves IDs and progress on reruns. It refuses conflicting existing answers. A rerun created zero exercises. Four tactical explanations were corrected through the normal edit/validate/publish revision workflow after initial publication; the final live check confirmed all 36 published answer identities match the source.

Verification: 82 tests passed across Pin, Double check, and learning; TypeScript and targeted ESLint passed. Live database checks confirmed all 324 prior exercise records, 36 prior progress records, and 76 prior attempt records remained unchanged.
