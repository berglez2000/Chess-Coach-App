# Endgame chapter expansion

Added 60 positions, bringing the library to 116. Existing IDs, FENs, routes, and progress versions are unchanged.

| Chapter | Added | Total | New topic filters |
| --- | ---: | ---: | --- |
| Basic checkmates | 12 | 15 | Queen, Rook, Two Rooks |
| King and pawn | 8 | 61 | Two Pawns vs Pawn |
| Rook | 16 | 16 | Rook vs Pawn, Rook Pawn vs Rook |
| Bishop | 8 | 8 | Bishop Pawn vs King, King vs Bishop Pawn |
| Knight | 8 | 8 | Knight vs Pawn, Knight vs Two Pawns |
| Queen | 8 | 8 | Queen vs Pawn, Queen vs Rook |

## Source and validation

Uses the same [Chess Endgame Training source](https://github.com/supertorpe/chessendgametraining/blob/0ff395ac711f54969fd2009d9b3df416a0eae936/code/src/static/endgamedatabase.json) and retained GPL-3.0 attribution/license as the prior pawn import. Records retain category, group, original one-based index, revision, and source URL. Descriptions and general hints are newly written; source mate-in counts are omitted.

Selects the first requested number of unique positions from each listed group in source order. All 60 selected entries passed: legal nonterminal FEN, waiting king not in check, at most seven pieces, no duplicates against existing or new positions, and live Lichess Syzygy objective verification. There were no mismatches or skipped duplicates in this batch. Results: 51 exact wins and 9 exact draws, from the solver/side-to-move perspective. Both solver colors remain supported.

Starting-position verification does not grade later moves. Winning objectives require eventual checkmate; drawing objectives require a drawn game. Normal practice uses the checked-in catalog and existing Stockfish/progress workflows without live tablebase requests.

Evidence: [additional-endgames-evidence.json](additional-endgames-evidence.json). Reproduce with `node scripts/import-additional-endgames.mjs /path/to/endgamedatabase.json` using the checksum-pinned source documented in [the original import report](king-and-pawn.md). All selected entries verify before catalog replacement.

## Chapter structure

Use material-based chapters, with concrete position-family filters within each chapter. Basic checkmates comes first, followed by pawn, rook, bishop, knight, and queen endings. Existing pawn URLs remain under `king-and-pawn`. Future curated teaching topics can cover opposition/key squares, pawn breakthroughs, Lucena/Philidor, bishop color, knight blockades, and perpetual-check defense once examples are individually reviewed for those concepts. This batch does not claim those named techniques are present solely from material classification.

## Software verification

13 focused catalog/component/route/progress tests passed, as did TypeScript, lint, and the webpack production build. No new browser or live Stockfish run is claimed.
