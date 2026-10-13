# Mate in 4

Source: user-supplied diagrams `chess-exercises-100.png`–`chess-exercises-102.png` (printed pages 117–119) and solutions `chess-exercises-123.png` (printed page 142), supplied on 2026-10-12.

The batch contains all 33 exercises, numbered 946–978, with the printed titles, White to move, and mate in four. Positions, practice answers, alternative book lines, and source page references are in `data/learning/mate-in-four.json`. The existing Learning reader uses the shared wooden board and piece images.

## Source details

- Promotion and zugzwang are preserved in 947, and promotion completes the answers in 949, 957, 965, and 973.
- Required SAN disambiguation is preserved in 962 (`Rfe1+`), 961 (`N5g6+`), and 975 (`Nhg6+`, `N5g6#`).
- Exercise 968 uses queen moves `Qd8+` and `Qxf8#`; its alternative defense ends with `Qd8#`.
- Alternative source continuations remain in explanations, including shorter mates and alternate promotions/captures. The deterministic practice reply follows the main book continuation.

## Verification and import

```sh
npx vitest run tests/unit/mate-four.test.ts
node --conditions=react-server --import tsx scripts/verify-mate-four.ts
node --conditions=react-server --import tsx scripts/import-mate-four.ts cmusdjfpn00008ququn4kk6n7 /tmp/mate-four-validation.json
```

The offline verifier exhaustively proves the authored opening moves and every subsequent printed solver move against every legal defense, including the alternative book lines. It prioritizes authored solver moves when searching without excluding any defensive replies. The budget is 2,000,000 nodes and five minutes per position; app search limits are unchanged.

Practice accepts the proven book opening moves and collects all winning subsequent solver continuations against its deterministic defensive replies. It does not enumerate unprinted alternative opening moves. Proofs use the distinct `exhaustive-authored-root-mate-v1` method and are cached at `/tmp/mate-four-validation.json` with the complete answer identity.

The importer validates the whole batch before writing, checks cached fingerprints and solution structure, and preserves existing exercise IDs and progress on identical reruns. Conflicting existing answers stop the import for review. Without a cache argument, the importer computes the same exhaustive proofs itself.

## Import result — 2026-10-12

Imported into the existing private material **1001 chess exercises for beginners**, immediately after “Mate in 3” (chapter order 16). All **33 exercises (946–978)** were created and published; no review-needed drafts remain.

Chapter ID: `cmv5d6isn0000dltqr0r54hq1`. Route: `/learning/chapters/cmv5d6isn0000dltqr0r54hq1`.

All 33 practice answers and all retained source variants passed exhaustive forced-mate verification. The 41 chapter/verifier tests, TypeScript check, and targeted ESLint check passed.
