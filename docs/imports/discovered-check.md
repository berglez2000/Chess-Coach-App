# Discovered check — exercises 277–300

Imported into the existing private **1001 chess exercises for beginners** book on 2026-10-09. All 24 exercises are published as chapter six at `/learning/chapters/cmv1eqtke0000edtq0nk2sjhu`.

Positions, titles, and solutions were transcribed from the user’s scans. Source references were checked against the stored book PDF (`cmuqvkqsm0006qotqkecscsj9`): introduction PDF page 33 / printed page 39; diagrams PDF pages 34–35 / printed pages 40–41; answers PDF pages 109–110 / printed pages 128–129.

The lesson includes all three teaching positions, including the windmill, using the shared wooden ReplayBoard. Lesson text is paraphrased.

Practice uses the existing SEQUENCE validator, checking legal authored moves rather than proving every material-gain claim or accepting every equivalent move. Main lines 282 and 289 exceed the seven-half-move practice limit: their first seven half-moves are practiced, and full continuations remain in explanations and `bookLines`. All book sidelines are preserved and legally checked, including the long mating variation in 290. All moves use canonical SAN; castling and en-passant rights are not inferred from diagrams.

Reproduce with:

```sh
node --conditions=react-server --import tsx scripts/import-discovered-check.ts MATERIAL_ID
```

The importer validates all entries and full book lines before writing, uses the existing owner-scoped publication workflow, and refuses conflicting answers. Rerunning created zero duplicate exercises. All published contents were compared with the source data. Snapshots confirmed the 276 previous exercises, 16 progress records, and 47 attempt records remained identical.

Validation: 113 tests passed across chapter and learning tests; TypeScript and targeted ESLint passed. The 29 new tests cover the 24 positions, complete lines, exact check/mate suffixes, longer practice boundaries, source coverage, and three lesson demonstrations.
