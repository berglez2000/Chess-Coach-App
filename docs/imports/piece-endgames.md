# More piece endgame practice

Added 80 positions to the existing library (196 total), preserving all earlier position IDs, FENs, routes, and progress versions.

| Chapter | Added | Chapter total | Added source groups |
| --- | ---: | ---: | --- |
| Rook | 20 | 36 | Rook vs Pawn: 10; Rook Pawn vs Rook: 10 |
| Bishop | 20 | 28 | Bishop Pawn vs Bishop: 10; Bishop vs Two Pawns: 10 |
| Knight | 20 | 28 | Knight vs Pawn: 10; Knight vs Two Pawns: 10 |
| Queen | 20 | 28 | Queen vs Pawn: 10; Queen vs Rook: 10 |

Uses the same checksum-pinned Chess Endgame Training source, revision `0ff395ac711f54969fd2009d9b3df416a0eae936`, and retained GPL-3.0 license described in [the prior report](additional-endgames.md). Each record retains source category/group/index/revision/URL and tablebase evidence. General hints and descriptions are newly written; no mate-in challenge is claimed.

The importer selects the first ten eligible unique entries from each group, skipping positions already present in the two earlier imports. All 80 new entries passed legal nonterminal setup, waiting-king safety, at-most-seven-piece, and catalog-wide duplicate checks. Live Lichess Syzygy returned the exact expected outcome for every selected position: 60 wins and 20 draws. No objective mismatch occurred. Evidence is retained in [piece-endgames-evidence.json](piece-endgames-evidence.json).

Reproduce with `node scripts/import-piece-endgames.mjs /path/to/endgamedatabase.json` using the pinned source. Every selected objective verifies before catalog replacement. Normal app use reads local data and needs no tablebase connection. Starting-position verification does not grade subsequent moves; wins still require final checkmate and draws a drawn game.

Software verification: 14 focused catalog/component/route/progress tests, TypeScript, lint, and webpack production build passed. No new browser or live Stockfish run is claimed.
