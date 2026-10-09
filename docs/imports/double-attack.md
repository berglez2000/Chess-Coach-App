# Double attack — exercises 217–252

Imported on 2026-10-09 into the existing private material **1001 chess exercises for beginners**. All 36 exercises are published in chapter four, **Double attack**.

Chapter URL: `/learning/chapters/cmv1e16v800003ttqtyplkesg`.

## Sources

Positions and titles were transcribed from the user-supplied diagrams and checked against the book PDF already stored in the app (`cmuqvkqsm0006qotqkecscsj9`). The stored PDF has twelve exercises per diagram page: PDF pages 27–29, printed pages 31–33. These offsets were inspected directly. Answers are on PDF pages 108–109, printed pages 127–128. The introduction is on PDF pages 25–26, printed pages 29–30.

`data/learning/double-attack.json` records exact positions, source references, book solutions, explanatory notes, and additional book variations. The chapter page includes a paraphrased introduction and all five teaching positions, using the shared wooden ReplayBoard. Lesson examples are separate from hidden practice answers.

## Practice and validation

These are material-gain and double-threat exercises, published as `SEQUENCE` using the existing legal-authored-sequence validator. This checks every move for legality; it does not claim exhaustive engine proof of a forced win or acceptance of every equally strong alternative.

The trainer uses one deterministic Black reply per prefix. Additional book lines for 219, 229, 234, 241, and 252 remain in the explanation and source data, where each was independently checked for legal transitions. The longer exercise 228 sideline, `Re8+ Bf8 Rxf8+ Kxf8 Nf5+ Kg8 Qf8+ Kxf8 Rd8#`, exceeds the seven-half-move practice limit; it is preserved in the explanation and tested through checkmate. Exercise 218 ends practice at Qxe6+, with the subsequent Rxd7 described in its explanation because the book does not specify a king reply.

Exercise 252’s alternate answer contains a printed move-number typo; the stored legal continuation is `dxc5 Nxc5 Qxg4`. The title of 221 corrects the PDF’s “Chamipion” typo to “Champion.” No castling or en-passant rights were inferred from diagrams.

## Reproduction and checks

```sh
node --conditions=react-server --import tsx scripts/import-double-attack.ts MATERIAL_ID
```

The importer validates all practice rows before writing, requires the existing private beginner book, uses the owner-scoped publication workflow, preserves matching published rows on reruns, and refuses conflicting existing answers. Source-only variation metadata is excluded from mutation inputs.

Verification: 64 unit/component tests passed across the new import tests and existing learning/solver tests; TypeScript and targeted ESLint passed. A live rerun created zero exercises and retained all 36 published entries. All 216 previous exercise IDs, revisions, publication IDs, and statuses were compared before and after and remained identical. Their progress records were not mutated.

## Supplied answer image cross-check

The subsequently supplied answer images were compared against all 36 solutions. Two explanatory transcription errors were corrected and published using the existing exercise IDs: 238 threatens **Qc7#**, and 241’s additional line ends **Re8+**, a winning check rather than checkmate (the black queen can interpose on f8). Practice moves remain unchanged. Regression tests verify both positions; all 39 import tests pass. Existing progress remains pinned to its original publication according to the normal revision workflow.
