# Mate in 3

Source: user-supplied diagrams `chess-exercises-093.png`–`chess-exercises-099.png` (printed pages 109–115) and solutions `chess-exercises-121.png`–`chess-exercises-123.png` (printed pages 140–142), supplied on 2026-10-12.

The batch contains all 81 exercises, numbered 865–945, with the printed titles, White to move, and mate in three. Transcriptions, main practice lines, alternate book lines, and page references are in `data/learning/mate-in-three.json`. The existing Learning reader displays these positions using its shared wooden board and piece images.

## Source notes

- **898:** The printed solution stops at `Rxb6+ Qxc6 Rxa2+`. Black's sole legal reply is `Qa4`; `Rxa4#` completes the forced mate in three. The incomplete printed line is retained in `bookLines`; the completed line is used for practice and explained to the learner.
- **943:** The printed `Qxh7+? Kxh7 Rh1+ Kg6!` is an unsuccessful try. It is retained separately in `analysisLines`, rather than presented as a mating solution.
- SAN uses required check and disambiguation suffixes, including `Rhf8` in 915 and `Qxg5+` in 938.
- Alternative source continuations remain in the explanations. Practice uses a deterministic defensive reply and accepts solver alternatives discovered by exhaustive verification.

## Validation and import

Run `npx vitest run tests/unit/mate-three.test.ts` for source numbering, provenance, all main mating sequences, all legal book sidelines, and focused exhaustive mate checks.

For full offline exhaustive verification, run:

```sh
node --conditions=react-server --import tsx scripts/verify-mate-three.ts
```

The verifier caches proofs at `/tmp/mate-three-validation.json`, matched by the complete answer identity. It uses the existing exhaustive AND/OR validator with a larger offline budget of 2,000,000 nodes and five minutes per position. No runtime search limits are changed.

Import and publish into the existing private beginner book:

```sh
node --conditions=react-server --import tsx scripts/import-mate-three.ts cmusdjfpn00008ququn4kk6n7 /tmp/mate-three-validation.json
```

The importer checks the entire batch before writing, checks proof fingerprints and solution structure, and preserves existing exercise IDs and progress on identical reruns. Without a cache argument it computes the same exhaustive proofs itself. Conflicting existing answers cause the import to stop for review.

## Import result — 2026-10-12

Imported into the existing private material **1001 chess exercises for beginners**, immediately after “Mixed motifs: Black” (chapter order 15). All **81 exercises (865–945)** were created and published; no review-needed drafts remain.

Chapter ID: `cmv5apotl00009btq2xgrorqf`. Route: `/learning/chapters/cmv5apotl00009btq2xgrorqf`.

All 81 practice answers passed the existing exhaustive forced-mate validator with the offline budget. The 86 chapter tests, TypeScript check, and targeted ESLint check passed.
