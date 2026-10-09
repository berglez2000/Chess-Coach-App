# King-and-pawn bulk import

First batch: 50 positions added to the existing King and pawn endgames chapter (53 positions total). Existing IDs, positions, and practice URLs are preserved.

| Source group | Winning objectives | Drawing objectives | Total |
| --- | ---: | ---: | ---: |
| Pawn vs King | 20 | 4 | 24 |
| Pawn vs Pawn | 10 | 6 | 16 |
| Two Pawns vs King | 9 | 1 | 10 |
| Total | 39 | 11 | 50 |

## Source and attribution

Position data is adapted from [Chess Endgame Training](https://github.com/supertorpe/chessendgametraining), maintained by supertorpe, pinned to revision `0ff395ac711f54969fd2009d9b3df416a0eae936`, file `code/src/static/endgamedatabase.json`. The repository identifies the [ECO Chess Opening Codes endgame database](https://ecochessopeningcodes.blogspot.com/) as an upstream resource. Its repository license is GPL version 3; a verbatim copy is retained at `public/licenses/chess-endgame-training-GPL-3.0.txt` and linked from sourced practice screens. No application code from that project is imported.

Each imported record retains the source URL, revision, category, subgroup, and original one-based position index. Starting FENs and target types come from the source collection. Titles are generated from group and source index. Descriptions and hints are newly written general teaching prompts, not copied author commentary or solution annotations. These imported records must not be described as original Chess Coach positions.

## Selection and validation

The batch selects the first 20 win / 4 draw Pawn vs King entries, first 10 win / 6 draw Pawn vs Pawn entries, and first 9 win / 1 draw Two Pawns vs King entries, retaining source order within each group. Other entries are deferred to later batches, rather than rejected as invalid.

Every selected setup was checked for legal FEN, a non-moving king not in check, nonterminal starting state, king/pawn-only material, and duplicate position keys. All 50 passed. No selected entries were skipped or rejected.

Every position was queried against the live Lichess Syzygy API. The side to move is the solver: source checkmate targets must return `win`, and draw targets must return `draw`. All 50 returned the expected exact category. Source mate-in numbers are deliberately omitted; no move-count challenge is claimed. Evidence stores the normalized FEN, category, DTZ, DTM when available, and query timestamp. Full source checksum, pinned revision, and per-position evidence are retained in `king-and-pawn-evidence.json`.

Winning practice objectives require final checkmate; pawn promotion alone does not complete them. Drawing practice requires a drawn game. Initial-position verification does not grade every subsequent move or change Stockfish's difficulty policy. Assisted/unassisted saved completion remains outside this import.

## Reproduction

Download the pinned source JSON from:

https://raw.githubusercontent.com/supertorpe/chessendgametraining/0ff395ac711f54969fd2009d9b3df416a0eae936/code/src/static/endgamedatabase.json

Run `node scripts/import-endgames.mjs /path/to/endgamedatabase.json` from the repository root with network access. It validates all selected entries before replacing the checked-in data; any mismatched/unavailable validation aborts the import. It makes 50 sequential public tablebase requests, with bounded timeouts, spacing, and retries for rate limits/server failures. Normal app use reads the local catalog and does not need tablebase network access.

## Browsing

Chapter pages display 12 positions per page, with filters for Introduction and the three imported source groups. Links retain the active group while changing pages. Each practice screen identifies its source and links to the retained license. The collection remains browsable with native links and direct practice URLs.
