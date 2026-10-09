# The missing piece — exercises 187–216

Imported on 2026-10-09 into the existing private material **1001 chess exercises for beginners**. All 30 exercises are published in its third chapter, **The missing piece**. The previous 186 exercises were preserved.

Chapter URL: `/learning/chapters/cmv1dfpxx0000nmtqco0hv1y9`.

## Source and transcription

Source: the user-supplied chapter introduction, five sheets containing diagrams 187–216, and two answer excerpts. The introduction establishes piece placement to create checkmate or a winning position and identifies printed answer page 127. Diagram-page numbers are not visible in the supplied sheets, so those fields are left empty rather than inferred from the contents page. No PDF page offsets or source PDF links were guessed.

Exact diagram positions, requested piece types, objectives, and answer transcriptions are recorded in `data/learning/missing-piece.json`. All placements use a white piece. Exercises 206 and 207 intentionally share a position but request different pieces and have different answers; they remain separate exercises.

## Validation and behavior

- 187–213: all 27 book placements produce checkmate. Every empty square was checked for another mating placement with the requested piece, leaving the White king safe.
- 202: the book gives **Rc6#**; **Re5#** also mates and is accepted as an alternative. The published book answer remains Rc6#.
- 214–216: the book gives **Be6+**, **Ne7**, and **Rc8**, respectively. These are validated as safe placements and checked against the supplied answers. The `+` on Be6+ is verified. No forced-win proof or continuation is claimed.
- Placement adds a piece to an empty square; it does not move an existing piece. Occupied squares, another piece type, exposed solver kings, and pawn placement on ranks 1/8 are rejected.
- Hints, reveal, retry, first completion, assistance, request deduplication, stale revisions, and private ownership use the existing Learning workflow. Solutions stay hidden until hint/reveal/completion, as appropriate.
- All boards use the existing wooden ReplayBoard and images.

## Reproduction

Validate and import with:

```sh
node --conditions=react-server --import tsx scripts/import-missing-piece.ts MATERIAL_ID
```

The importer validates the full batch before writing, selects an explicit existing private beginner book material, preserves matching published exercises on reruns, and refuses conflicting existing answers. New exercises are validated and published through the owner-scoped Learning revision workflow. It does not share the material with other accounts.

Verification: unit and component tests cover all supplied answers, the alternative mate, placement input, invalid answers, answer concealment, Black placement, and assistance/retry. Database integration tests cover publication, persistence, account isolation, and duplicate delivery. Browser checks cover authoring previews and practice at desktop/mobile widths.
