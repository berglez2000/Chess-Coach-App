# Beginner puzzle book: next imports

Source: contents-page image supplied on 2026-10-09. The image contains chapter titles and printed start pages, but no positions, exercise numbers, answers, or book title. Confirm the source matches the existing “1001 chess exercises for beginners” material before importing into it.

## Chapter order

| Chapter | Printed start page | Current evidence / next action |
| --- | ---: | --- |
| Mate in one | 7 | Local import report records 57 published exercises; verify live material before changes. |
| Mate in two | 13 | Local import report records 129 published exercises; verify live material before changes. |
| The missing piece | 25 | Imported and published exercises 187–216 from supplied images; see `missing-piece.md`. |
| Double attack | 29 | Imported and published exercises 217–252; see `double-attack.md`. |
| Discovered attack | 35 | Imported and published exercises 253–276; see `discovered-attack.md`. |
| Discovered check | 39 | Imported and published exercises 277–300; source and importer are checked in. |
| Double check | 43 | Imported and published exercises 301–324; see `double-check.md`. |
| Pin | 47 | Imported and published exercises 325–360; see `pin.md`. |
| Skewer | 53 | Obtain diagrams and answers. |
| Deflection | 57 | Obtain diagrams and answers. |
| Decoy sacrifice | 61 | Obtain diagrams and answers. |
| Pawn promotion | 65 | Obtain diagrams and answers. |
| Drawing tactics | 71 | Obtain diagrams and answers; inspect required draw objective before publishing. |
| Mixed motifs: White | 75 | Obtain diagrams and answers. |
| Mixed motifs: Black | 93 | Obtain diagrams and answers. |
| Mate in three | 109 | Obtain diagrams and answers; existing mate validator supports three moves. |
| Mate in four | 117 | Obtain diagrams and answers; existing mate validator supports four moves within search limits. |
| Curiosities | 121 | Obtain diagrams, instructions, and answers; inspect exercise rules individually. |

These are printed page numbers from the image. PDF page indices must be checked against the actual PDF; do not assume a fixed offset.

## First batch

Chapters through “Pin” are complete. The next chapter is “Skewer,” starting on printed page 53. Obtain its diagrams and corresponding answers before importing.

For each exercise, capture its source number, title, exact position, side to move, objective, answer branches, and diagram/answer page references. Retain uncertain transcriptions as drafts. Validate legal moves and mating claims using the existing Learning workflow, and preserve exercise IDs and progress when updating an existing import.

Use the existing Learning material/chapter structure and shared wooden ReplayBoard. The contents page alone is insufficient to create playable exercises. No playable exercises were created from the contents-page image alone; the later supplied diagrams and answers enabled the Missing Piece import.

## Existing references

- `mate-in-one.md`: local position transcriptions.
- `mate-in-two.md`: local position transcriptions.
- `mate-in-two-import-report.md`: records publication of 186 exercises on 2026-10-04; this is historical evidence, not a live database check.
- `lib/learning/content.ts`: move/mate validation and the current Missing Piece publication restriction.
