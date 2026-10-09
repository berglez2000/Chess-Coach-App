# Chess Coach — future development backlog

TASK-049 — “Beat your past self” is implemented. The user requested the plan and authorized implementation on 2026-10-09. See the task below and [BEAT_YOUR_PAST_SELF_PLAN.md](BEAT_YOUR_PAST_SELF_PLAN.md) for scope and acceptance.

Source: [original ideas](CHESS_COACH_FUTURE_SPECS.md). Existing V0.1 work and evidence remain in [TASKS.md](TASKS.md).

This backlog is not authorization to implement every task. The user authorized email/password auth and ownership (TASK-029–030) and review exploration (TASK-028), then requested starting the next tasks on 2026-10-01. TASK-031–032 are implemented. The user requested TASK-033 and TASK-034 on 2026-10-02; both are now implemented. On 2026-10-03 the user requested refinement of TASK-035–037 around their supplied book exercise and future PDF extraction, then authorized starting implementation. TASK-035–036 and TASK-038–039 are now implemented; TASK-037 remains deferred; TASK-040 is rejected; TASK-041–044 were TODO at that planning stage (TASK-042 was subsequently confirmed complete by the user). On 2026-10-04 the user removed automatic PDF import from scope in favor of manual authoring, deferred TASK-037, and authorized TASK-038–039, confirming reusable weekly plans. On 2026-10-05 the user rejected TASK-040, authorized TASK-041, kept TASK-037 low priority, and requested tasks for app-wide UI polish, more book exercises, and endgame practice. On 2026-10-06 the user requested backlog entries for manually authored opening preparation/practice, adjustable Stockfish play, and deeper analysis; opening practice is the most important of these new ideas. The user subsequently confirmed the existing UI/design work was already done and authorized TASK-045, confirming board/PGN authoring, saved-branch acceptance, transposition matching, and private local MP4 uploads capped at 100 MB. TASK-045 is implemented. The user authorized TASK-046 on 2026-10-08; TASK-046 and the existing TASK-047 analyzer are now implemented. IDs continue after TASK-027; dependencies and the recommended sequence determine implementation order. Resolve a task's open decisions before implementing that task. Record implementation evidence before marking it DONE.

## Priority and sequence

- **P1:** next useful capabilities and foundations.
- **P2:** learning-library expansion after the core practice workflow.
- **P3:** features that depend on learning content or a public launch.

TASK-042 was reported complete by the user on 2026-10-06; its prior design-first sequence is no longer the next step. TASK-045 opening library/practice is now implemented. TASK-047 deeper analysis and TASK-046 Stockfish play are now implemented. Recommended next feature: **044 endgame follow-ups**. Its position library, Stockfish practice, and saved private progress are implemented; guided solutions and per-move correctness grading remain open. TASK-041 landing/app entry remains separately authorized; TASK-043 content expansion depends on supplied source exercises. This does not change the existing authorization for TASK-041. Content entry for TASK-043 can proceed independently when source exercises are available. **TASK-040 is REJECTED** and excluded from implementation. **TASK-037 is deferred / low priority** and can resume independently when the user supplies a representative example.

The app is for personal use initially, but accounts and data ownership come first by user decision so future multi-user use is handled now. Complete TASK-029–030 before the other new features. The landing page is now authorized; coordinate its design with TASK-042. Public launch is not required to implement it.

TASK-026 is still BLOCKED by existing release acceptance requirements. Track it separately; new planning does not resolve its missing live coaching evidence or build decision. Public deployment is a separate scope decision, not an implied part of adding login or a landing page.

## Confirmed decisions

1. Personal use first, with authentication and user ownership implemented now for future growth.
2. Review-board Reset returns to the exploration starting position.
3. Learning exercises are added manually. PDFs retain their separate `/books` page. Automatic PDF-to-exercise import was removed from scope by the user on 2026-10-04.
4. Email/password login only initially. Keep user identity independent of credentials so Google can be added later through explicit account linking.
5. Review exploration uses manual play for both sides without live engine evaluation (confirmed for TASK-028).
6. PDFs, reading progress, and positioned checkmarks are stored in PostgreSQL and synchronized through the owning account (confirmed for TASK-034 on 2026-10-02).
7. Weekly learning plans are reusable templates (confirmed for TASK-039 on 2026-10-04); dated weekly tracking (TASK-040) was rejected on 2026-10-05. Keep the reusable template workflow.

8. TASK-041 is authorized; TASK-037 is not urgent.
9. UI polish must cover every page, with designs prepared using Open Design and design files/previews shared in the session before UI implementation.
10. Expand manually authored book content with Forks, Pins, Mate in Three, Mate in Four, and further chapters agreed from the source book.
11. Manually author opening descriptions, uploaded MP4 videos, and approximately 20–30 variations per opening. Opening practice selects a random variation and automatically plays the opponent’s moves.
12. Endgame practice includes playing a supplied board position to completion against Stockfish, with adjustable engine strength.
13. Deeper analysis shows the top three engine moves, continuation lines, an evaluation bar, and numerical evaluations; expose it in opening preparation, game review, Stockfish play, and a standalone analysis page.

## Remaining implementation decisions

For TASK-041, confirm the proposed landing/dashboard routes. For TASK-043, identify the source exercises and target chapters/counts. For TASK-044, agree initial endgame topics, position sources, and correctness policy; Stockfish play from a supplied position is now requested. TASK-045 decisions were confirmed in this session and are recorded below. TASK-046–047 now use local server-side Stockfish with bounded time presets; analysis assistance explicitly pauses active play. TASK-046 uses skill-level difficulty presets and temporary sessions with PGN export.

Before TASK-037 implementation, inspect a user-supplied Missing Piece example and its solution to establish the required placement and objective. Weekly plans use reusable templates (confirmed by the user on 2026-10-04).

TASK-031 started with one-move puzzles; TASK-033 extends new generation to at most three solver moves (five total plies). The refined learning tasks below specify implementation defaults: account owners author private material; shared curated content has operator-controlled publication; answer-changing revisions require fresh completion while retaining history. These defaults are planning choices, not claims of separately confirmed user preferences. Reusable editable weekly plan templates without calendar integration were confirmed on 2026-10-04. Automatic PDF diagram/solution extraction is no longer planned; exercise authoring remains manual.

## Tasks

### TASK-028 — Explore legal variations on the review board

Status: DONE
Priority: P1  
Dependencies: existing TASK-006 and TASK-014

Scope: enter exploration from the selected review position, play legal moves for either side, undo moves, and reset to the exploration starting position. Offer an explicit “Try the better move” entry from `fenBefore` so a mistake can be corrected. Keep existing game-start navigation distinct from exploration Reset.

Acceptance:
- Reject illegal moves, including a pawn moving three squares; handle promotion, castling, en passant, check, and terminal positions.
- Exploration never changes the imported PGN, saved moves, or analysis.
- Reset restores the exact exploration starting FEN, including side to move and castling/en-passant state, and clears the explored moves.
- Clearly distinguish the variation from the recorded game. Hide or label recorded evaluations/coaching when they no longer describe the displayed position.
- Returning to review restores its selected position and annotations; selecting another game move exits exploration predictably.

Verification: chess-state unit tests and board interaction tests, including custom starting FEN and Black orientation. Live engine evaluation and saved variation trees are follow-up scope unless requested.

Notes (2026-09-30): implemented temporary legal variations with drag/drop, source/destination clicks, keyboard coordinate entry, selectable promotion pieces, undo, exact starting-FEN reset, and return to the selected review position. “Try the better move” starts at `fenBefore`. Recorded evaluations/coaching are hidden; selecting a recorded move or game navigation exits exploration. Review arrow shortcuts pause during exploration. Move history retains repetition detection. No saved game or analysis writes, automatic opponent replies, live evaluation, or saved variation trees.

Verification: Node 24.21.0 lint, typecheck, all 380 unit/component tests, and webpack production build passed. Added 15 tests covering illegal moves, both turns/orientations, castling, en passant, all promotions, check, terminal positions, repetition, exact FEN restoration, custom Black-to-move positions, better-move entry, annotation restoration, and saved-game immutability. Board interactions use the real board component in jsdom; no new browser E2E run is claimed. TASK-026 release blockers remain separate.

### TASK-029 — Add accounts and session lifecycle

Status: DONE  
Priority: P1  
Dependencies: none among future tasks

Scope: implement email/password registration/sign-in/sign-out, session handling, and a minimal profile. Include a documented local account-recovery flow for personal use. Email delivery/verification and Google sign-in can be added for a future public launch; do not automatically link unverified email identities.

Acceptance:
- A user can create/access an account, sign out, and receives useful validation/session-expiry feedback.
- Protected screens and server operations check the session on the server.
- Record the selected auth approach and required configuration; no public multi-user release until TASK-030 passes.

Verification: successful and failed authentication, expired sessions, logout, and direct unauthenticated requests.

Notes (2026-09-30): implemented Better Auth 1.7.6 with email/password registration, login, database sessions, logout, profile/password changes, database-backed rate limiting, origin checks, and local operator password recovery. User IDs are separate from credential accounts; automatic linking is disabled. Added environment setup and recovery documentation. Password forms are disabled before hydration and use POST as a fallback. No email delivery or Google integration is claimed.

Verification: lint, typecheck, 365 unit/component tests, 47 integration tests, and webpack production build passed on Node 24.21.0. Browser auth journey passed at 390px: registration validation, login, password change, logout, reload, and direct cross-user requests. Existing White/Black review and unavailable-provider browser journeys also passed. TASK-026's pre-existing release blockers remain separate.

### TASK-030 — Make saved data private to its owner

Status: DONE  
Priority: P1  
Dependencies: TASK-029

Scope: associate games and provider preferences with users; scope library counts, reviews, import, analysis, retries, and regeneration to their owner. Assign existing local games/settings to an explicitly selected owner through a documented migration. Server API keys remain server configuration.

Acceptance:
- Two users cannot read or mutate each other's games by guessing IDs or calling endpoints directly.
- Dashboard counts and provider preferences are user-specific; background/ongoing writes retain the correct owner.
- Existing local data survives migration; ownership is never silently awarded to the first public registrant.
- Future puzzles, attempts, learning progress, and plans use this ownership boundary.

Verification: two-user integration tests for every relevant read/write endpoint, plus migration against a disposable copy of representative legacy data.

Notes (2026-09-30): game reads/counts/imports, engine/coaching run reads and writes, and provider preferences are scoped to authenticated user IDs. New users have separate settings; server API keys remain installation configuration. The additive migration retains legacy rows with a null owner, hidden from web users. `npm run auth:admin -- claim-legacy you@example.com` assigns only unowned games to an explicitly registered account and preserves existing personal preferences. No automatic first-registrant claim exists.

Verification: the checks recorded under TASK-029 passed, including two-user browser/API checks and engine/coaching repository isolation. A temporary-schema migration test verified preservation of legacy PGN, moves, coaching, and settings, no claim on signup, idempotent explicit assignment, and refusal during unfinished legacy analysis. The migration was also applied successfully to the local development database. Local auth settings were added to ignored `.env.local`; the user must register and explicitly assign their legacy games. No account or password was created on the user's behalf.

### TASK-031 — Generate validated one-move puzzles from my games

Status: DONE
Priority: P1  
Dependencies: TASK-028, TASK-030

Scope: add “Puzzles from this game”; select the user's instructive mistakes using saved engine data, validate candidates, and persist versioned puzzles with source game/ply, starting FEN, player color, and accepted solution moves. Start before the user's mistake. Skip ambiguous or weak candidates rather than converting every mistake into a puzzle.

Acceptance:
- Every solution is legal and engine-supported; AI prose alone cannot decide correctness.
- Define an explicit engine quality/alternative-move policy and save the generation configuration.
- Repeated generation does not duplicate the same puzzle version; failed generation is retryable and leaves the review intact.
- Games with no suitable candidates show an honest empty state; engine-only reviews can qualify without coaching.

Verification: fixtures for both colors, clear tactical wins, ambiguous alternatives, no candidates, and repeated/failed generation.

Notes (2026-10-01): added explicit “Puzzles from this game” generation below the saved review. Requires complete saved engine analysis; AI coaching is optional. Policy v1 checks up to five of the user's largest mistakes/blunders with saved loss ≥100 cp. Fresh Stockfish depth-14 MultiPV=2 searches require legal lines, exact scores at matching depths, agreement with the saved best move, and a unique best root. Accepts a winning evaluation ≥200 cp with ≥150 cp separation (or a losing-mate alternative), or mate within five moves with no second winning-mate line and a runner-up ≤500 cp. Only the best move is accepted; ambiguous or weak candidates are skipped.

Versioned generation stores the policy, source game/ply/run, starting FEN, player color, solution, and validation evidence. Atomic publication, unique constraints, a five-minute lease, and token fencing prevent duplicate/partial/stale writes. Ownership follows the source game. Completed results, including empty results, are reused for the same policy version. Saved games and analysis remain unchanged. Puzzle solving/attempts remain TASK-032; continuation play remains TASK-033. Position-only engine searches do not reconstruct historical repetition.

Verification: Node 24.21.0 lint, typecheck, all 414 unit/component tests, all 53 integration tests, and webpack production build passed. Tests cover both colors, alternatives, invalid lines, empty results, retries, rollback, duplicate prevention, lease recovery, ownership isolation, API authentication, and UI interactions. Live Stockfish depth-14 MultiPV smoke check accepted a unique mate-in-one position. Applied the additive migration to both test and local development databases. No new browser E2E run is claimed; TASK-026 release blockers remain separate.

### TASK-032 — Solve personal puzzles and save attempts

Status: DONE
Priority: P1  
Dependencies: TASK-031

Scope: puzzle board, answer checking, retry, hint/reveal, next puzzle, and return to source review. Save attempts and completion separately from puzzle definitions.

Acceptance:
- Orient the board for the solver and conceal answers until requested or completed.
- Distinguish illegal moves, legal incorrect moves, accepted alternatives, and successful solutions.
- Record assisted versus unassisted outcomes; refresh preserves saved progress without creating duplicate completions.
- Answers are checked authoritatively by the server; one user's attempts cannot affect another's progress.

Verification: solver interaction tests and persisted attempt/reload tests, including assisted completion.

Notes (2026-10-01): added the private `/puzzles` library with per-game filtering, pagination, saved completion labels, and review entry links. `/puzzles/[id]` orients the real board for the solver and supports drag/drop, square clicks, keyboard coordinates, and selectable promotion. Server-side chess legality and the persisted accepted-move list distinguish illegal, incorrect, correct, and accepted-alternative answers. Browser DTOs omit answer lists and validation evidence; only a saved hint, revealed answer, or completed solution is returned when appropriate. Next-puzzle navigation and return to the exact source-review ply are included.

Attempts/actions and one per-user completion are stored separately from immutable definitions. Hints/reveals mark subsequent practice assisted, including after reload/retry. Reveal alone does not complete a puzzle. The first completion and its assisted/unassisted label survive repeat practice; seeing a solved answer makes subsequent practice assisted. Request IDs deduplicate retries, revision checks reject stale-tab writes, and transactional row locking prevents lost assistance or duplicate completions. Network errors allow status refresh or replay of the same request. All reads and mutations check source-game ownership.

Verification: Node 24.21.0 lint, typecheck, all 434 unit/component tests, all 59 integration tests, and webpack production build passed. Two Chromium puzzle journeys passed (White desktop and Black at 390px), covering actual board clicks, illegal/incorrect answers, accepted alternatives, reload, hint/reveal/retry, assisted and unassisted completion, next puzzle, exact source navigation, and unauthenticated/cross-account API denial. Additional tests cover underpromotion, castling, server payload validation, lost-response retry, competing tabs, idempotency, immutable definitions, and private lists/progress. Applied the additive migration to test and local development databases. Multi-move sequences remain TASK-033; TASK-026 release blockers are unchanged.

### TASK-033 — Support multi-move tactical sequences

Status: DONE
Priority: P1  
Dependencies: TASK-032

Scope: extend puzzles into validated solution branches; automatically play engine-selected opponent replies and let the user make subsequent moves. Initial limit: three solver moves, with at most two opponent replies.

Acceptance:
- Every transition is legal; accepted alternatives have validated continuations, not a mismatched original principal variation.
- The puzzle ends at a defined instructional goal, terminal position, or validated sequence boundary.
- Handle wrong moves, promotion, restart, and delayed replies without duplicate moves or corrupt state.
- Save the versioned solution/reply policy so retries behave consistently; prefer precomputed lines for the initial version.

Verification: alternating-turn sequences, alternative branches, mate, restart during a reply, and completion persistence.

Notes (2026-10-02): policy v2 generates precomputed lines with up to three solver moves. The existing conservative root-selection thresholds remain; each opponent reply and subsequent solver move receives a fresh depth-14 MultiPV search from its actual position. Replies require complete, exact, legal root evidence; solver moves require a unique winning/mating root, or a sole legal winning move. Generation accepts only one validated move per solver position initially. The branch format independently validates alternative continuations and deterministic replies; tests exercise alternatives without transplanting a principal variation. Ambiguous or incomplete continuation evidence ends the puzzle at its last validated solver move. Checkmate, terminal positions, and validated boundaries are distinguished. All search evidence and the versioned reply/solution policy are persisted.

The additive migration adds nullable solution definitions and saved move histories. Null definitions retain policy-v1 behavior; old puzzles, attempts, and completion history remain unchanged. Policy-v2 generations coexist with v1 and are deduplicated independently. Correct moves and automatic replies commit in one transaction using the existing request-ID and revision safeguards. Reload resumes the exact sequence; stale tabs and delayed retries cannot append replies after restart. Inputs, including restart, are locked during an unresolved request. Hints target the current branch and are cleared after advancing; reveals expose the whole matching line without completing it. Assistance and first completion survive restart and repeat practice. Browser DTOs include only past moves until completion/reveal. Generation renews its fenced five-minute lease before each search; recovery starts five minutes after its last renewal.

Verification: Node 24.21.0 lint, typecheck, all 449 unit/component tests, all 62 integration tests, and webpack production build passed. White desktop and Black 390px Chromium journeys passed for both one-move puzzles and new sequences, including actual board clicks, alternative replies, incorrect moves, midway reload, hint/reveal/restart, and saved completion. Tests additionally cover mate, underpromotion, castling, malformed branches, depth/bound completeness, delayed requests, lease renewal, ownership, immutable definitions, and preserved legacy versions. Live Stockfish depth-14 MultiPV validation generated `Qg8+ Rxg8 Nf7#` from `3r1r1k/ppp3pp/7N/8/8/1Q6/8/6K1 w - - 4 3`, freshly validating both continuation positions. Applied the migration to test and local development databases. The first expanded browser run hit the existing signup rate limit; reusing each journey's account resolved the test issue without changing authentication. TASK-026 release blockers remain separate.

### TASK-034 — Integrate the existing PDF reader

Status: DONE
Priority: P2  
Dependencies: TASK-030

Reference: `/Users/aljaz/Desktop/Chess Books/index.html`. Read-only inspection found PDF.js rendering, IndexedDB PDF storage, localStorage metadata, last-page progress, thumbnails, and per-page checkmarks.

Scope: adapt the reader into a separate `/books` page, preserving import/library, navigation, reading position, and checkmarks. Store PDFs and progress in PostgreSQL, synchronized through the authenticated owning account. PDFs are separate from manually authored learning exercises.

Acceptance:
- Import and reopen a PDF, resume reading, add/remove marks, and remove a book without affecting others.
- Report invalid files/storage failures; support responsive and keyboard navigation.
- Explain the storage boundary. Existing standalone browser data does not automatically transfer between origins; provide a documented re-import path. By the confirmed database-storage decision, no browser-storage or progress export/import workflow is required.
- Logout/account switching does not expose another user's PDFs, thumbnails, or progress on a shared browser, including an already-open reader tab.

Verification: reader interactions and database persistence checks through the browser with small sample PDFs. Automatic puzzle extraction is separate scope.

Notes (2026-10-02): the user confirmed PostgreSQL storage rather than browser-local storage. Added authenticated `/books` navigation and a separate PDF library/reader with multiple-file selection/drop import, generated first-page thumbnails, page input/previous/next, keyboard navigation, fit-width/zoom, exact reading-position resume, positioned per-page checkmarks, a keyboard-accessible center-mark action, and confirmed deletion. PDFs, thumbnails, reading positions, and marks are stored in owner-scoped database rows; raw PDFs and thumbnails use private no-store endpoints. Session changes unmount the open reader and destroy its PDF worker. No IndexedDB/localStorage book data or PDF extraction is introduced.

Server-side PDF.js 6.3.289 validation rejects malformed/encrypted PDFs and limits files to 100 MB and 10,000 pages; streamed uploads are bounded before buffering. This accommodates the approximately 40 MB existing source books. Imports publish PDF and metadata atomically; per-owner SHA-256 deduplication preserves existing progress on re-import. Revision-checked transactions prevent stale tabs/devices from overwriting progress or duplicating marks. Failed or lost-response updates reconcile from saved state; deletion cascades only that book's marks. The version-matched PDF.js worker is served locally and prepared during install/dev/build/start. Standalone reader data remains at its original origin; re-import the original PDFs, with previous standalone progress not transferred. Database backups now include the PDF bytes and progress.

Verification: Node 24.21.0 lint, typecheck, the full 452-test unit/component suite plus three additional endpoint tests, all 67 integration tests, and webpack production build passed. Two Chromium journeys (1200px desktop and 390px mobile) used an original three-page PDF fixture and actual canvas interactions to verify invalid import feedback, thumbnails, exact PDF retrieval, positioned marks, zoom, keyboard/page-input navigation, reload/resume, removal, deduplicated re-import, private response headers, direct cross-account API denial, and logout/account switching with an open reader in another tab. Integration checks cover actual PDF parsing/thumbnail generation, saved bytes/progress/marks, concurrent revisions, rollback, ownership, and deletion isolation. Applied the additive `20261002140000_books` migration to test and local development databases; existing game and puzzle data are unchanged. TASK-026 release blockers remain separate.

Follow-up (2026-10-02): investigated a reported HTTP 500 when importing the 126-page beginners PDF. The running development server used Herd's Node 20.19.4, where PDF.js initialization throws `Promise.withResolvers is not a function` before the loading promise can be handled. Installed Node 24.21.0 alongside the existing nvm runtime and restarted the app on port 3000 with it. Added Node-version checks before dev/build/start and an actionable HTTP 503 for an unsupported PDF runtime. Lint/typecheck and five focused runtime/endpoint regression tests passed. A temporary isolated browser diagnostic uploaded the exact reported PDF, verified byte-for-byte database retrieval, and rendered pages 1 and 2 successfully under both webpack and explicit Turbopack. Diagnostic accounts/books were cleaned up and the temporary test/configuration removed; no book was imported into the user's account. The nvm default alias was not changed; future terminal launches should run `nvm use` first.

Diagram-rendering follow-up (2026-10-02): the reference book's chessboards use JBIG2 compression. PDF.js reported missing `wasmUrl` and failed to initialize the decoder, leaving diagrams blank while text and the page-render promise succeeded. Asset preparation now copies the version-matched WASM decoders/fallbacks, CMaps, standard fonts, and accompanying licenses locally; browser rendering and server thumbnail generation receive their respective resource paths. The optional `book-diagrams.spec.ts` regression accepts a local reference PDF via `CHESS_BOOKS_DIAGRAM_PDF`, checks successful JBIG2 decoder loading, rejects decoding warnings, and requires actual dark pixels inside the previously blank first-board region. The exact book's page 7 passed this isolated browser check; visual inspection confirmed all twelve diagrams. No copyrighted book bytes are included in the repository. The active app serves the decoder assets successfully; refreshing the reader uses the existing saved PDF and progress.

### TASK-035 — Build the book/chapter/exercise library and authoring workflow

Status: DONE
Priority: P2  
Dependencies: TASK-030

Scope: authenticated `/learning`, material detail, ordered chapters, and an owner-accessible exercise editor. Represent a book or other study material as material → chapter → numbered exercise. Preserve the source structure, including chapters such as Mate in One, Mate in Two, Forks, Pins, Mate in Three, Mate in Four, and Missing Piece. Chapter labels organize content; exercise types define behavior. Keep the workflow usable without a PDF or extraction service.

Authoring and content defaults:
- Account owners create/edit their own private materials, chapters, and exercises. Shared curated content is explicitly published through an operator-controlled workflow and is read-only to learners; private book collections never become shared implicitly.
- Store stable material/chapter/exercise IDs, explicit ordering, and source exercise numbers separately from internal IDs. Optional provenance includes book title/edition, diagram and solution page references, and an owner-accessible PDF link. Distinguish PDF page indices from printed page labels. Removing the PDF must not delete exercises or their progress.
- Move exercises store title, prompt, full starting FEN, solver color, objective (`mate-in-n` with a move bound, or an authored tactical sequence), published solution text, structured accepted solution branches, optional hints/explanation, and validation evidence/version. Published answers and accepted alternatives are distinct fields. Forks/Pins can use move exercises; Missing Piece has a separate type and remains unavailable for practice until TASK-037.
- Provide FEN entry and an editable board with piece placement/removal, side to move, castling rights, and en-passant state. Support entering SAN solution lines and converting them to unambiguous move coordinates for server validation. Authors can preview the resulting board and replay every branch.
- Use draft → validated → published states. Incomplete drafts may be saved; server validation is required before publication. Editing answer-affecting content invalidates validation and creates a new published revision rather than mutating a revision used by attempts. Title, ordering, and other presentation-only changes preserve answer revision identity.

Acceptance:
- Navigate material → chapter → exercise and return with chapter/order context preserved; provide useful empty states and explicit previous/next navigation.
- Validate position consistency, solver turn, all solution moves/promotions, and each branch's declared endpoint. A mating line proves that line ends in mate; it does not by itself prove forced mate against every defense. TASK-036 defines objective validation and alternative handling before move exercises become playable.
- Distinguish placement-mode diagrams from playable chess positions: incomplete Missing Piece diagrams must not be rejected solely for failing ordinary legal-position requirements.
- Reject cross-account reads/writes, private-content publication by another user, duplicate source exercise numbers within the same chapter, and stale authoring updates. Reordering keeps stable exercise references and saved attempts intact.
- Include a reproducible, explicitly owner-selected sample creation flow for the user-supplied exercise below. Do not automatically assign book content to all users or assume access to the rest of the book.
- Store optional source references and validation metadata so future PDF imports can create the same drafts without introducing a second exercise format.

Reference sample supplied by the user (2026-10-02):
- Material: `1001 chess exercises for beginners`; chapter: `Mate in One`; source exercise number: `1`.
- Title: `The pin is mightier than the sword`; White to move; objective: mate in one.
- FEN: `kr6/1p6/p7/4b3/8/8/1P4BP/R6K w - - 0 1`.
- Published solution: `Rxa6#`; move coordinates: `a1a6`.
- The supplied FEN/solution were checked with chess.js: the move is legal and results in checkmate. Source PDF page and edition have not been supplied in this example; leave them unset.

Verification: authoring/preview/publication, ordering and stable references, incomplete drafts, invalid FEN/solutions, revisions, empty chapters, private/shared visibility, two-user isolation, and sample creation in an explicitly selected account. No bulk book import is claimed.

Notes (2026-10-03): implemented authenticated `/learning`, private materials, ordered chapters/numbered exercises, owner-only authoring, and explicit operator publication of shared read-only curated material. The editor accepts FEN and piece placement/removal with keyboard square input, explicit side/castling/en-passant state, SAN branches, per-branch replay, prompts, hints/explanations, and optional printed page/PDF provenance. Invalid or incomplete diagrams remain editable drafts; Missing Piece cannot be published for practice. Save/validate/publish uses optimistic content revisions and immutable published definitions. Publishing a replacement leaves prior attempts intact; title/order/provenance-only edits preserve answer identity. Archives preserve history, and shared lists omit unpublished exercises. The supplied book sample is available through an idempotent, account-selected button, not automatic installation or bulk import. Added `learning:admin -- share owner@example.com material-id` and authoring documentation.

Verification: Node 24.21.0 lint, typecheck, all 465 unit/component tests, all 75 integration tests, and webpack production build passed. Desktop (1200px) and mobile (390px) Chromium journeys created the sample, navigated book/chapter/exercise, authored and previewed another exercise, validated/published it, and checked direct unauthenticated/cross-user denials. Integration checks cover private/shared visibility, duplicate numbers, stale authoring, immutable revisions, owner-selected sample deduplication, and unowned PDF references. Browser checks caught and resolved a source-PDF field lookup error and navigation race after draft creation. Applied the additive `20261003120000_learning` migration to test and local development databases and restarted the local Node 24 development server. No user account or book content was created outside the explicit sample action. TASK-026 remains separate.

### TASK-036 — Practice book exercises and track versioned progress

Status: DONE
Priority: P2  
Dependencies: TASK-032, TASK-033, TASK-035

Scope: reuse the puzzle board and interaction patterns for published move-based chapter exercises; support automatic validated opponent replies, hints/reveal, retry, previous/next, resume, and chapter/material progress. Learning definitions and attempts must not require a source game or fake game records. Keep `/puzzles` personal-game practice working with its existing versions.

Solution and correctness policy:
- Extend the learning solution format to at least four solver moves (seven total plies) for Mate in Four. Keep the existing personal-puzzle generation policy and three-move versions compatible; do not silently change their generation/completion rules.
- For `mate-in-n`, define the objective as forcing mate within at most N solver moves. Verification must account for opponent defenses, not merely replay one cooperative mating line. Store the validation method, limits, and evidence. Inconclusive validation leaves an exercise unpublished for practice, with actionable feedback; AI prose or an engine principal variation alone cannot establish correctness.
- For Mate in One, enumerate legal moves and accept every move that immediately checkmates. For longer exercises, persist prevalidated accepted branches and deterministic practice replies; engine-assisted validation must establish the declared mate bound and each accepted continuation under a documented policy. Keep the book's published answer separately visible after reveal/completion. Flag unsupported alternatives for author review rather than reporting an unvalidated move as objectively wrong.
- Tactical sequence exercises use explicit authored/validated branches and a stated instructional endpoint. Feedback distinguishes an illegal move, an accepted move, a move that fails a validated mate objective, and a legal move outside the exercise's validated solution set. Avoid promising exhaustive alternative coverage for sequence exercises.
- Publish a finite solution set before practice; solving causes no automatic AI calls. Each accepted alternative has its own legal continuation. Branches cannot borrow a mismatched original variation.

Progress and revision defaults:
- Persist attempt state and one completion per user, exercise, and answer revision. Reload restores the exact current branch/position. Preserve first completion and assisted/unassisted outcome; retry or repeated solves do not inflate totals. Hint/reveal use persists across reload/retry, and reveal alone does not complete an exercise.
- Chapter/material totals count currently published, playable exercise revisions. Drafts and unsupported types do not inflate the denominator. Show unavailable types clearly; no playable exercises has an explicit empty state.
- Answer-affecting edits create a fresh revision requiring fresh completion; retain prior attempts/completions as history and explain the changed exercise. Presentation-only edits and reordering preserve completion. A practice attempt is pinned to its revision; publication of a replacement cannot change its answer midway. Archived content retains history but leaves current totals and next-exercise navigation.
- Resume an in-progress current revision first, otherwise the next unfinished exercise in chapter order. A completed chapter offers repeat practice. PDF reading position/checkmarks remain separate from exercise completion.

Acceptance:
- Support both colors, promotions, wrong moves, hints, full solution replay/explanation, restart, completion, and context-preserving chapter navigation without exposing unrevealed solutions in initial browser payloads.
- Server-authoritative actions retain request deduplication and revision/concurrency safeguards. Delayed replies, refresh, competing tabs, and retry cannot duplicate moves or lose assistance/history.
- Saved progress is private even for shared curated exercises; direct endpoints enforce content visibility and user ownership.
- The supplied exercise completes on `Rxa6#`; include original fixtures for Mate in Two through Mate in Four and alternative solutions without assuming additional book content is available.

Verification: actual board interactions, all supported move lengths, forced-mate validation versus a cooperative line, valid alternatives, legal unsupported moves, promotions, partial/completed chapters, repeat attempts, reload/resume, edits/reordering/archive, lost responses, competing tabs, and two-user isolation. Record a browser journey from library → chapter → supplied exercise → saved completion.

Notes (2026-10-03): chapter practice reuses the real puzzle board, promotions/coordinates, automatic precomputed replies, hints/reveal/retry, and previous/next navigation with learning-specific objectives and book solutions. Learning definitions/progress have their own tables without source-game records. Solution format v2 supports four solver moves/seven half-moves while preserving personal-puzzle v1 schemas and generation policy. Mate validation uses an exhaustive AND/OR proof against all legal defenses, discovers all accepted solver continuations for deterministic practice replies, and retains published SAN separately. It is bounded to 100,000 nodes, five seconds, and 1,024 practice branches; inconclusive positions stay drafts. Legal authored tactical sequences use explicit boundaries and label unsupported legal moves accurately. Validation stores its method and evidence without engine/provider calls.

Attempts/completion are per user and immutable answer revision. Request IDs, revision checks, and transactional row claims handle stale tabs and lost responses; assistance and first completion survive reload/retry. Practice URLs pin the answer revision so reload cannot silently adopt a newly published answer. Chapter resume prefers an unfinished current attempt; current totals exclude drafts/archives and count the current published revision once. Earlier/archived completions remain in `/learning/history`. Initial practice DTOs conceal solutions and explanations. PDF reading progress stays independent.

Verification: the checks under TASK-035 passed. Unit fixtures cover the supplied mate, multiple immediate solutions, forced Mate in Two/Three, the at-most-four mate bound with promotion, a seven-ply authored sequence, rejection of cooperative mating lines, bounded-search failure, branch legality/conflicting replies, and preserved legacy limits. Integration checks cover completion/reload, assistance/reveal/retry, simultaneous duplicate delivery, stale revisions, pinned earlier attempts, new-answer completion reset, presentation-only identity, archives, and private progress for shared content. Both learning Chromium journeys passed actual board clicks, wrong answers, reload, assisted/unassisted completion, chapter resume/totals, and history. Existing White desktop and Black 390px personal-puzzle Chromium journeys also passed. A combined run encountered the existing signup rate limit; running learning and puzzle suites separately resolved the test issue without changing authentication. No live engine/provider acceptance or PDF extraction is claimed; TASK-026/037 remain separate.

### TASK-037 — Add “Find the missing piece” authoring and practice

Status: TODO  
Priority: P2  
Dependencies: TASK-035, TASK-036

Scope: add a placement exercise type to the same learning library and progress system. Before implementation, inspect an actual user-supplied Missing Piece diagram, prompt, and answer; do not infer this book's rules from the chapter name.

Planned format:
- Store an incomplete diagram as a piece map, its prompt/objective, and a declared answer mode: choose a square for a specified piece, choose a piece for a specified square, or choose both. Specify piece color as well as kind, allowed squares/pieces, and every accepted placement.
- Store a separate completed position and supporting solution/explanation for each accepted placement when the objective requires subsequent legal chess play. The incomplete diagram is not itself required to be a legal playable FEN.
- First version places one missing piece. Multiple missing pieces and compound placement-then-play exercises require separate refinement rather than an implicit expansion of scope.

Acceptance:
- Prompts and controls make the required answer explicit; support piece selection and square selection with mouse/touch and keyboard. Reject occupied/disallowed squares and malformed submissions without changing the diagram.
- Check placement answers on the server against the published exercise revision; validate each authored completed position and any supporting move sequence before publication. Do not use ordinary legal-move input rules to judge piece placement.
- Preserve multiple valid answers and provide correct/incorrect feedback, authored hints, reveal, retry, explanation, saved assistance, and completion using TASK-036 progress semantics. Reveal alone does not complete the exercise.
- Placement interactions are scoped to this exercise type; review and tactical boards retain their normal move interactions. Initial practice payloads conceal accepted placements/supporting answers.
- Missing Piece exercises join chapter totals/resume only after their type is supported and their revisions are published/validated.

Verification: all three answer modes with original fixtures, occupied/disallowed squares, piece kind/color, multiple accepted placements, incomplete diagram handling, supporting solution validation, keyboard/mobile interactions, reload/retry, reveal versus completion, revision changes, and user isolation. Add the user's representative example once supplied.

### TASK-038 — Capture learning goals and availability

Status: DONE
Priority: P2  
Dependencies: TASK-029, TASK-030

Scope: roughly ten short profile questions covering rating/experience, goals, weaknesses, available days/minutes, preferred activities, and learning resources. Let users edit their answers.

Acceptance:
- Optional or unknown rating is supported; time budgets and availability are validated.
- Save answers per user and show a review step before generating a plan.
- Record which answers informed each future plan without overwriting prior plan inputs.

Verification: incomplete survey, invalid availability, editing, persistence, and user isolation.

Notes (2026-10-04): implemented `/learning/profile`, linked from Learning and Account, with ten questions covering experience, optional rating/platform/time control, goals, weaknesses (including Not sure), playing habits, available days with independent minute budgets, preferred activities, visible learning materials/owned PDFs, other resources, and current focus. Review shows all answers and weekly minutes before saving. Editing/cancel, reload persistence, unavailable-resource feedback, and failed-save retry are included. No AI/provider calls or weekly plan generation occur.

Profiles are owner-scoped immutable database snapshots with versioned answers and selected resource titles. Future plans can reference the saved snapshot ID; editing creates a new snapshot without rewriting earlier inputs. Server validation rejects incomplete/invalid schedules, duplicate selections, unsupported values, unknown fields, and inaccessible resources. Transactions serialize saves; stale edits fail and identical lost-response retries return the already saved result. Applied the additive migration to the dedicated test and local development databases.

Verification: Node 24.21.0 lint, typecheck, all 475 unit/component tests, all 77 integration tests, and webpack production build passed. Desktop (1200px) and mobile (390px) Chromium journeys passed library navigation, incomplete-form validation, unknown rating, different daily budgets, review-before-save, save/reload/edit, stale-tab rejection, invalid direct requests, origin checks, unauthenticated denial, and cross-account isolation. Integration tests verify reopened-client persistence, retained earlier snapshots, resource isolation, concurrent saves, and idempotent retries. Initial browser checks required disambiguating the Next.js route announcer and waiting for the existing signup limit; the final suite reuses its second account and passes without authentication changes. TASK-039 and existing TASK-026 release blockers remain separate.

### TASK-039 — Generate an editable weekly learning plan

Status: DONE
Priority: P3  
Dependencies: TASK-038, TASK-036

Scope: use the selected AI provider to propose sessions for tactics, own-game puzzles, lessons, endgames, and review based on the survey and available material. Confirmed format: reusable weekly template.

Acceptance:
- Validate structured output, time totals, available days, and referenced content IDs before saving.
- Never invent an available book/chapter or promise measured improvement; generic activities are labeled as such.
- Preview, edit, accept, and explicitly regenerate a plan; errors preserve the last accepted plan.
- No automatic paid calls on page load; record provider/model and the inputs used.

Verification: deterministic provider fixtures for invalid schedules, nonexistent resources, timeout, edits, and regeneration. Record a separate live acceptance check when configured.

Notes (2026-10-04): implemented `/learning/plan` with explicit selected-provider generation, persisted proposal preview, session/title editing, add/remove, exact per-day totals, separate acceptance, and explicit regeneration. The server builds a bounded owner-visible resource catalog, prioritizes selected profile resources, and includes only learning materials/chapters with published exercises plus available PDFs/games/puzzles. Generic sessions have explicit labels and fixed instructions; provider output cannot introduce links/resource descriptions or improvement claims. Both Anthropic and OpenAI adapters use structured output and semantic schedule/resource validation. No provider calls occur on page load or status polling, and no provider fallback exists.

Generation stores the profile and resource snapshot, requested/actual model, provider, original generated definition, editable proposal, and durable request identity. One request is bounded to 60 seconds/4,096 output tokens with no automatic paid retries. User-row locks, revisions, and two-minute fenced leases handle concurrent generation/edit/accept, lost-response retries, expiry/recovery, and late responses. Failures retain the accepted template and previous proposal. Acceptance creates an immutable version with its original inputs; profile edits do not rewrite it. Content visibility is rechecked before saved edits/acceptance, and unavailable references are labeled. Applied the additive migration to test and local development databases. Completion/skip/reschedule and calendar weeks were originally deferred to TASK-040; that task was rejected on 2026-10-05.

Verification: Node 24.21.0 lint, typecheck, all 500 unit/component tests, all 84 integration tests, and webpack production build passed. Desktop (1200px) and mobile (390px) Chromium journeys passed library entry, missing-profile state, no generation on load, actual published-chapter references, explicit generation, request replay, editing/generic study, save/accept/reload, provider switching, failed regeneration preserving acceptance, new-profile snapshots, identical-template regeneration with explicit review/acceptance, invalid schedules, origin/session checks, and cross-account mutation denial. Additional fixtures verify SDK refusals/incomplete output, sanitized errors/missing keys, invalid references/budgets, lost responses, simultaneous requests/edits, expiry/fencing/late timeout responses, deleted/private content, and retained original definitions/accepted history. A PostgreSQL JSON key-order retry issue found during integration was corrected by canonical validation before comparison.

Separate live acceptance: OpenAI `gpt-5.4-mini-2026-03-17` generated three valid sessions totaling 65 minutes in 4,026 ms from synthetic inputs, with no database writes/account data. Anthropic's configured API key was rejected; successful live Anthropic acceptance is not claimed. Its deterministic adapter tests pass. `npm run test:plan -- OPENAI|ANTHROPIC` provides an explicit bounded smoke check. TASK-026 release acceptance remains separate.

### TASK-040 — Follow the plan and record weekly completion

Status: REJECTED
Priority: P3  
Dependencies: TASK-039

Decision (2026-10-05): rejected by the user. Retain the original scope below for history only; do not implement or include in the recommended sequence. Reusable weekly templates from TASK-039 remain supported.

Scope: show this week's sessions, link to their activities, and support complete/skip/reschedule with weekly progress. Snapshot template sessions into dated weeks so recurring use has distinct history.

Acceptance:
- Edits/regeneration do not erase completed history; week boundaries use the user's selected timezone.
- Reading and offline study can be manually completed; defined exercise targets can use recorded attempts.
- Prevent duplicate completion and preserve progress across sessions.

Verification: week rollover, rescheduling, repeated completion, and plan replacement. Automatic adaptive replanning, reminders, and calendar integration are future scope.

### TASK-041 — Add the public landing page and app entry flow

Status: TODO  
Priority: P1 (authorized by the user on 2026-10-05)
Dependencies: TASK-029 and TASK-030 for registration/sign-in calls to action

Scope: modern responsive page explaining review, practice, and learning with accurate screenshots/examples and clear entry actions. Propose `/` for the landing page and `/dashboard` for the existing dashboard; confirm this route choice before implementation.

Acceptance:
- Visitors can understand available features and enter registration/sign-in; signed-in users can reach their dashboard directly.
- Preserve existing game/review URLs and update internal dashboard links.
- Upcoming capabilities are labeled accurately; layout works on mobile and with keyboard navigation.

Verification: anonymous/signed-in navigation, route redirects, responsive layout, and accessibility checks. Hosting, pricing, subscriptions, and payments are not included in this task.


### TASK-042 — Modernize the UI/UX across every page

Status: DONE (user-confirmed on 2026-10-06)
Priority: P1
Dependencies: existing application pages; coordinate with TASK-041

Completion note: the user confirmed this existing work was already done when asked about starting the design phase. TASK-045 reuses the current visual system. This session did not create or independently audit the prior Open Design files.

Scope: improve every page's UI and UX through a consistent modern visual system and clearer interactions. Prepare designs first using Open Design, retain the generated design files, and share the designs/previews in the session before implementation. Open Design was unavailable in the planning session; tool availability must be resolved before claiming this design requirement complete.

Design coverage:
- Inventory all routes and shared navigation, including the landing/dashboard, game library/import/review/exploration, puzzles, Books/PDF reader, Learning/materials/chapters/authoring/practice/history, learning profile/weekly plan, settings, and account/auth/recovery screens.
- Establish typography, color, spacing, layout, cards, forms, buttons, navigation, and chess-board surroundings as reusable styles/components.
- Provide desktop and mobile designs plus loading, empty, error, validation, disabled, and success states where relevant. Share design files and preview images in the session with a route coverage checklist.

Acceptance:
- Every page receives a documented UI/UX review and implementation against the prepared designs; no route is silently omitted.
- Improve information hierarchy, navigation, form feedback, readability, and primary actions while preserving working chess, authoring, account, and persistence flows.
- Layouts work on narrow mobile screens and desktop; controls support keyboard navigation, visible focus, accessible labels, and readable contrast.
- Keep shared components consistent and preserve board interaction, promotion, PDF controls, and concealed practice answers.

Verification: route-by-route design/implementation coverage, desktop/mobile visual review, keyboard checks, and browser journeys for the affected core flows. Record design artifact locations and share previews before page implementation; do not mark DONE for designs alone.

### TASK-043 — Add more book puzzle chapters and exercises

Status: TODO
Priority: P2
Dependencies: TASK-035, TASK-036

Scope: expand the existing book material with manually entered Forks, Pins, Mate in Three, Mate in Four, and further agreed chapters. This is content expansion using the existing authoring/practice system. Automatic PDF extraction remains outside scope.

Before entry: inspect the supplied book/source exercises and answers, identify existing material/chapter content to avoid duplicates, and agree the chapter order and first batch of exercise numbers/counts. Do not invent positions or label original fixtures as book exercises.

Acceptance:
- Preserve chapter names/order, printed exercise numbers, diagram/answer page references, side to move, exact positions, published answers, and explanations where supplied.
- Validate every exercise before publication. Mate in Three/Four must satisfy the existing forced-mate policy; legal cooperative lines alone are insufficient. Forks/Pins use explicit legal tactical branches and instructional endpoints.
- Exercises exceeding current validation/solution limits remain drafts with actionable feedback; identify any required validator extension separately.
- New published exercises participate in chapter navigation, resume, hints/reveal, and versioned progress without resetting existing completions.
- Record an entry report with source coverage, added/skipped/duplicate exercise numbers, and validation issues. Select the intended account/material explicitly; retain existing ownership and operator-controlled sharing.

Verification: compare entered positions/solutions to source material, replay validated branches, and practice representative Forks, Pins, Mate in Three, and Mate in Four exercises with saved completion/reload. No supplied batch means content entry remains pending.

### TASK-044 — Add endgame practice

Status: IN PROGRESS — position library, Stockfish practice, and saved private progress implemented
Priority: P2
Dependencies: TASK-046 for Stockfish play; TASK-035, TASK-036 where existing learning content/progress is reused

Scope: provide dedicated endgame learning/practice with clear objectives, feedback, retry, hints/reveal, explanations, and saved private progress. On 2026-10-06 the user specified starting from a supplied board position and playing to completion against Stockfish. Initial topics, objectives, and position sources remain to be selected.

Decisions before implementation:
- Choose the first topics and representative positions. Suggested starting topics for discussion: king-and-pawn endings, opposition, basic checkmates, and basic rook endings.
- Implement open play against Stockfish from a supplied position via TASK-046. Decide whether guided finite exercises should also be offered; existing learning exercises can support some finite lines.
- Define each objective (mate, promote, win, or hold a draw), accepted alternatives, opponent policy, completion boundary, and correctness evidence. Specify engine/tablebase requirements and availability if selected; a single authored line cannot establish every endgame outcome.
- Decide how users enter endgame practice and whether content lives in the existing material/chapter structure or needs a dedicated view. Agree the initial content batch and its sources.

Acceptance:
- Each playable position has a stated objective and validated legal setup; feedback distinguishes illegal moves, proven objective failures, accepted alternatives, and unvalidated continuations.
- Practice supports both colors, legal opponent replies, promotion, terminal outcomes, restart, and meaningful explanation under the selected policy.
- Solutions remain concealed until hint/reveal/completion; assistance and first completion use versioned private progress, with reload and duplicate-request safeguards.
- Display unavailable validation/opponent services clearly and preserve progress on failures. Any incomplete coverage or bounded validation is explained accurately.

Verification: representative agreed endgame positions, objective correctness and alternatives, win/draw/stalemate handling, both colors, promotions, hints/reveal/retry, reload, revision changes, and cross-user isolation. Refine these checks once the first practice mode is chosen.


Implementation (2026-10-08): added authenticated `/endgames`, dashboard/sidebar/mobile entry points, and six original teaching setups: king/queen, king/rook, queen as Black, advanced-pawn conversion for both colors, and rook-pawn draw defense. These are original positions, not imported book content. Practice reuses ReplayBoard, the wooden assets, and PlayWorkspace with fixed starting FEN/player side/Stockfish opponent, adjustable difficulty, legal moves, promotion, restart, PGN export, optional hints, and opt-in analysis assistance. Objective feedback uses the actual final chess.js outcome: checkmate must be delivered by the player; a draw objective requires a drawn game; resignation fails. Promotion alone does not complete a mating objective. Intermediate continuations are not graded.

This implements the recommended initial position-library slice. Saved versioned progress, assistance tracking, reload recovery, guided reveal/solutions, and engine/tablebase correctness grading remain unimplemented; the UI states these limitations. TASK-044 stays IN PROGRESS rather than DONE. No database migration or external position-source dependency was added.

Verification: Node 24.21.0 lint, typecheck, all 657 unit/component tests (74 files), and webpack production build passed. Tests cover catalog legality/nonterminal setups for both colors, outcome/winner/resignation checks, preset locking, hidden hints, restart, and navigation. No new live Stockfish or browser acceptance run is claimed. Lint ignores local Python virtual environments so Maia's third-party JavaScript is not treated as application source.

Chapter follow-up (2026-10-08): reorganized `/endgames` as a Learning-style chapter grid with Basic checkmates and King and pawn endgames. Authenticated `/endgames/[chapterId]` pages list each chapter's positions with wooden ReplayBoard previews, player color, objectives, and practice links. `/endgames/[chapterId]/[positionId]` opens the existing Stockfish workspace with chapter breadcrumbs and previous/next navigation. Unknown IDs and cross-chapter position URLs return not-found. Existing six positions and practice behavior are preserved; content expansion and persistent progress remain separate work. Lint, typecheck, focused component/route tests, and webpack production build verify the change.

Bulk-content follow-up (2026-10-08): user authorized the first king-and-pawn bulk import. Added 50 positions from the pinned Chess Endgame Training data collection (24 Pawn vs King, 16 Pawn vs Pawn, 10 Two Pawns vs King), retaining source revision, group, index, target, and license notice. All selected FENs passed legality/nonterminal/material/duplicate checks and live Lichess tablebase verification: 39 `win` and 11 `draw` objectives. The chapter now has 53 positions; Basic checkmates remains at three. Added topic filters, 12-position pagination, per-practice source/license links, a checksum-pinned reproducible import script, and [import report/evidence](docs/imports/king-and-pawn.md). Descriptions/hints are newly written; these positions are labeled sourced, not original. Lint, typecheck, 15 focused tests, and webpack production build passed. Saved learning progress and per-move grading remain follow-ups; no new database writes or browser acceptance run is claimed.

Saved-progress follow-up (2026-10-09): user authorized continuing TASK-044 with saved attempts/completion, assistance tracking, chapter progress, and session recovery. Added account-owned PostgreSQL progress plus an action history, keyed by position and an answer-changing version (FEN, player side, objective). Snapshots retain exact legal UCI move histories, Stockfish difficulty, resignation, and hint/analysis assistance. First completion and its assisted/unassisted label survive restarts; every new session increments the attempt count. Previous action snapshots remain retained. Answer-changing content edits require fresh completion while retaining the earlier version. Chapter/library pages show completion counts and per-position status.

Server writes replay moves from the catalog FEN, reject illegal/post-terminal histories and active-session rewrites, keep assistance sticky within an attempt, and derive completion from actual mate/winner/draw outcomes. Session/origin checks and owner-derived queries protect every write/read. Revision fencing serializes concurrent tabs; request IDs make duplicate/retried saves idempotent. Practice pauses during pending/failed saves, exposes Retry save, warns on leaving with unsaved changes, and uses keepalive requests. Reload restores the last successfully saved game paused, including hint visibility, so engine play resumes explicitly. Browser crashes/offline exits cannot guarantee delivery of an unsaved request. Restart retains prior completion/history and begins a new attempt. The existing wooden ReplayBoard appearance is preserved.

Saved-progress verification: all 669 unit/component tests passed, followed by five added focused API tests; two dedicated-database integration tests passed, including simultaneous duplicate saves, concurrent edit conflicts, invalid-history rollback, cross-user isolation, revision changes, and first-completion preservation. Two Chromium journeys at 1200px/390px passed with simulated engine replies and real test-database saves, move/hint reload recovery, resignation, restart, failed-save retry, anonymous/origin rejection, and second-account isolation. Both chapter screenshots were visually reviewed; no horizontal overflow. TypeScript, lint, and webpack production build passed. The additive migration was applied to the dedicated test and local development databases. No new live Stockfish run is claimed. Guided reveal/solutions and engine/tablebase per-move correctness grading remain separate follow-ups; TASK-044 stays IN PROGRESS.


Chapter expansion (2026-10-09): user requested more endgame examples and chapter structure. Added 60 checksum-pinned Chess Endgame Training positions: 12 basic checkmates, 8 two-pawns-versus-pawn, 16 rook, 8 bishop, 8 knight, and 8 queen endings. Library now has six material-based chapters and 116 positions, with position-family filters. Existing IDs/FENs/routes/progress versions remain unchanged. All 60 passed legality/nonterminal/material/duplicate checks and live Lichess Syzygy verification (51 exact wins, 9 exact draws). Source attribution and validation evidence are retained in [the expansion report](docs/imports/additional-endgames.md). These checks establish starting objectives only; guided solutions and per-move grading remain open. Verification: 13 focused catalog/component/route/progress tests, TypeScript, lint, and webpack production build passed. No new browser or live Stockfish acceptance run is claimed.


Further piece practice (2026-10-09): user requested more Rook, Bishop, Knight, and Queen examples. Added 20 to each chapter (80 total); chapter totals are now 36, 28, 28, and 28 respectively, and the entire library has 196 positions. Bishop filters now include Bishop Pawn vs Bishop and Bishop vs Two Pawns. All prior positions and progress versions remain unchanged. Live Lichess Syzygy verified 60 exact winning and 20 exact drawing starting objectives; legality/nonterminal/material/catalog-wide duplicate checks passed. Source provenance, reproducible importer, and evidence are retained in [the report](docs/imports/piece-endgames.md). Verification: 14 focused catalog/component/route/progress tests, TypeScript, lint, and webpack production build passed. No new browser or live Stockfish run is claimed. Per-move grading remains open.


### TASK-045 — Add a manually authored opening library and variation practice

Status: DONE
Priority: P1 (highest priority among the new ideas added on 2026-10-06)
Dependencies: existing account ownership, game library, and shared chessboard; TASK-047 for later integrated engine analysis

Scope: add an openings listing and a separate detail page for each manually added opening. Include a short description, the user's games played in that opening, uploaded MP4 videos, and a Lichess-study-like editor for manually entering and editing approximately 20–30 variations. The central feature is practicing randomly selected authored variations while the computer automatically plays the opponent's moves.

Acceptance:
- Owners can create/edit openings, descriptions, videos, and legal branching variations for both colors; preserve private ownership and validate authored moves.
- Opening detail pages show related owned games under a defined matching rule and playable uploaded MP4 videos, with useful empty/error states.
- Practice selects a random variation from the chosen opening, accepts the user's moves, automatically plays the opponent's authored replies, and lets the user continue to the next variation.
- Support legal board interaction, promotion, retry, and a clear completion boundary. Define how wrong moves, hints/reveal, and moves belonging to another saved branch are handled before implementation.
- Reuse ReplayBoard and the existing boardTheme/customPieces wooden board and image pieces for authoring and practice.

Decisions before implementation: choose practice color/start position controls, game matching by move sequence or position (including transpositions), video storage/upload limits, and variation selection/repetition policy. Mistake tracking and weighted repetition are possible extensions, not confirmed requirements.

Verification: create/edit an opening with branching variations, match representative owned games, upload/play MP4s, and practice random variations for both colors with automatic replies, incorrect moves, promotions, completion, next variation, and ownership isolation.


Confirmed decisions (2026-10-06): board-based branching authoring plus PGN import/export; per-opening practice color and optional custom starting FEN; accept another saved branch and continue its authored replies; incorrect moves do not change the position; hint/reveal and retry; shuffle without selection repeats until the cycle finishes; position matching includes transpositions; private MP4 uploads on local server disk with a 100 MiB per-file bound.

Implementation (2026-10-06): added `/openings`, create/detail/edit/practice pages, desktop/mobile navigation and a dashboard entry. Openings and legal variation definitions are private PostgreSQL data with optimistic revision checks. The editor branches from selected moves, extends leaves, renames/removes lines, imports nested SAN PGN variations, and exports separate PGN games. Supports up to 100 variations and 160 plies per line; supplied positions check both kings, the non-moving king's check state, and castling pieces. All boards use ReplayBoard and the existing wooden assets, including selectable promotion pieces.

Practice selects a shuffled authored line, automatically replies for the opponent, and accepts other saved branches. Illegal/incorrect moves preserve the position. Hint/reveal assistance persists through retry; completion and next variation have explicit boundaries. Practice is session-only, with no saved attempt history or live engine evaluation. Related owned games are matched through FEN position identity without clocks, after four plies for a normal start or from a custom start, within the first 40 plies; latest 50 matches are shown. Private MP4 streaming supports byte ranges and ownership/origin checks, stores random filenames outside `public/` in `.storage/opening-videos/`, and cleans failed uploads and removed videos. Back up storage with the database; browser codec support is required.

Verification: Node 24.21.0 lint, TypeScript, all 531 unit/component tests, three opening database integration tests, and webpack production build passed. Three Chromium browser journeys passed: desktop (1200px), mobile (390px), and nested-PGN/custom-FEN/promotion branches. Checks cover real board clicks, both practice colors, wrong/illegal moves, automatic replies, hint/reveal/retry/next, underpromotion, reload, transposed-game matching, real H.264 MP4 playback/range requests, and unauthenticated/cross-user opening/video denial. Added 21 unit/component tests for opening legality, imports, position identity, special moves, randomized selection, editor/practice interactions, bounded JSON/video reads, and storage errors. Applied `20261006150000_openings` to dedicated test and local development databases. TASK-026 release blockers remain separate.

Runtime follow-up (2026-10-06): the existing dev server retained a pre-opening Prisma singleton through hot reload, causing `db.opening` to be undefined despite the applied migration. The shared database cache now records generated model names and replaces/disconnects a stale singleton when the models change. Opening error recovery uses Next 16.3 `retry()` to refetch, and its message no longer incorrectly assumes a database outage. Verified the development opening repository query, lint/typecheck, and four regression tests covering cache reuse/replacement and error retry.

Practice refinement (2026-10-06): user requested move sounds, a one-second pause for computer replies, and larger boards. Opening authoring/practice now uses the existing move-sound hook and assets with shared mute controls; accepted user moves appear/sound immediately and replies are scheduled one second later. Pending replies lock board input/hints and cancel on retry/reveal/unmount. Wider opening pages and reduced board card padding enlarge desktop and mobile boards while preserving the wooden theme. Regression checks cover timing, illegal/incorrect silence, mute, Black’s initial reply, and stale-timer cancellation. Verification: all 538 unit/component tests, lint, TypeScript/webpack production build, and all three opening browser journeys passed. Browser checks confirm move-audio calls, larger boards (at least 550px at 1200px viewport and 340px at 390px), and no mobile horizontal overflow; desktop/mobile screenshots were visually reviewed.

### TASK-046 — Play against Stockfish with adjustable strength

Status: DONE
Priority: P2
Dependencies: existing legal move handling and shared chessboard; coordinate engine execution with TASK-047

Scope: play a complete game against Stockfish with adjustable difficulty. Support both the normal starting position and a supplied board position so TASK-044 can use the same opponent for endgame practice.

Acceptance:
- Select a side and engine strength; validate supplied positions and have Stockfish play legal replies automatically.
- Handle promotion, checkmate, stalemate, draws, resignation, restart, and engine failures with clear game state.
- Endgame practice can start from a supplied position and continue to the end against Stockfish.
- Integrate deeper analysis from TASK-047 with an explicit policy for when suggestions are visible during play versus afterward.
- Reuse ReplayBoard and the existing wooden board/piece assets; preserve private ownership for saved sessions if persistence is included.

Decisions before implementation: engine execution location, strength settings and their limits, time controls/search budgets, position input method, and whether games/session history are saved.

Verification: games at representative strength settings, both colors, custom endgame starts, legal engine replies, promotions, terminal outcomes, restart, and engine interruption/recovery.

Implementation (2026-10-08): authenticated `/play` with dashboard/sidebar/mobile-menu entry. Select White/Black, normal/custom six-field FEN, and Easy/Casual/Challenging/Strong (Stockfish Skill Level 0/5/10/20; 250/500/1,000/2,000 ms per reply). Presets are not calibrated Elo ratings; no clock is used. Automatic legal replies preserve complete move history for repetition. Shared wooden ReplayBoard supports dragging, square clicks, coordinates, all promotions, flipping, and move sounds. Pause/resume, explicit retry, resignation, restart, terminal/draw outcomes, and PGN download are available. Sessions are temporary; import downloaded PGN through the existing workflow for owned saving/review. No new database migration is needed. The initial move limit is 400 half-moves.

Analysis assistance pauses play and exposes the shared opt-in TASK-047 panel; closing it resumes. Client cancellation and response fencing protect restart, pause, resignation, analysis, and unmount. The bounded 10 KB endpoint checks session/origin, legal history, engine turn, difficulty, unknown fields, and the existing per-user/two-process engine capacity guard. Failures preserve the position and require explicit retry. Engine analysis settings remain unchanged unless skill is explicitly supplied for play.

Verification (2026-10-08): 632 unit/component tests, lint, TypeScript, and webpack production build passed. New checks cover both colors, legal/illegal moves, each difficulty, wrong-turn/forged/oversized requests, session/origin guards, cancellation/concurrency, restart fencing, underpromotion/draw, resignation, assistance pause, and failed-engine recovery. `npm run test:play` passed against installed Stockfish at all four difficulties with normal/custom starts and legal replies; live TASK-047 MultiPV/cancellation checks also passed. Both Chromium journeys passed at 1200px/390px with mocked legal engine responses and real isolated-database authentication, covering square clicks, White/Black starts, fixed difficulty selection, assistance pause, resignation, PGN download, restart, terminal custom positions, and session/origin denial. Screenshots were reviewed; no horizontal overflow was detected. Browser findings corrected explicit selector labels and disabled setup controls before hydration.

Millennium extension (2026-10-08, explicitly requested by user): `/play` now supports selectable ChessLink physical input, normal/custom starts, automatic square-order calibration, stable legal human moves and slow pressure-board transitions. Stockfish replies remain digitally authoritative and are shown as SAN/UCI with board highlights; the app requires physical execution of the exact engine target before accepting another human move. CLink-mode instructions, optional listen-only, manual S query, disconnect/reconnect, hidden-tab pause, mismatch recovery, and explicit resumption are included. Mode change closes Bluetooth and fences stale work. No LED commands are sent. Shared transport/decoder and legal incomplete-move recognition are reused without changing the recorder's default behavior. Tests cover both player colors, reversed reports, duplicate frames, premature next moves, disconnect/reconnect, mode cleanup, custom castling/en passant/underpromotion, and missing-history rejection. Verification: all 639 unit/component tests passed before the final restart regression; all four focused Millennium component tests then passed, including pending-move restart fencing. Lint, TypeScript, and webpack production build passed. Existing on-screen Stockfish journeys and both Millennium journeys at 1200px/390px passed, using real isolated-database authentication, simulated GATT notifications, and deterministic legal engine replies; screenshot review and overflow checks passed. Physical acceptance requires the user's board; simulated tests do not establish CLink hardware compatibility.

Stockfish LED follow-up (2026-10-08, user-requested): added enabled-by-default LED prompts using documented volatile L/X commands. Blink remaining target/physical differences, using calibrated square order and all special-move squares; clear prompts on synchronization, pause, restart, resignation, disabling, and physical-input cleanup. Added LED status, toggle, and explicit retry. Writes use checksum/parity framing, serialized 20-byte BLE fragments, generation fencing, and a 15-second deadline; failed partial writes disconnect. Recorder listen-only behavior remains unchanged. No EEPROM, brightness, reset, or automatic mode changes are added. Verification: all 648 unit/component tests, lint, TypeScript, and webpack production build passed; 26 focused transport/component tests passed again after final error reporting. Both desktop/mobile Stockfish-play simulations verify exact outgoing LED frames (including reversed square order), 20-byte packets, and X clearing after physical synchronization. Recorder desktop passed; mobile timed out during an edited dev-server run at the saved-review link and passed when rerun without code edits. Hardware LED illumination still requires user confirmation.

### TASK-047 — Add deeper analysis with the top three engine moves

Status: DONE
Priority: P1
Dependencies: existing Stockfish analysis integration, legal move handling, game review, and shared chessboard; TASK-045/TASK-046 for their respective integrations

Scope: provide deeper position analysis for opening preparation, game review, and Stockfish play, plus a standalone analysis page where the user manually plays moves for White and Black. Show the best, second-best, and third-best engine moves with continuation lines, an evaluation bar, and numerical evaluations such as +0.32, +0.28, and +0.14. Support understanding and exploring alternatives without requiring the user to choose the engine's top move.

Acceptance:
- Use MultiPV analysis to display up to three legal candidate moves and their continuations; handle positions with fewer legal moves and mate scores correctly.
- Keep evaluation perspective consistent and clearly labeled; show search depth/progress so partial results are understandable.
- Manually enter moves for either side, navigate the explored line, and analyze the currently selected position.
- Integrate the same analysis controls into opening preparation, game review, and Stockfish play while preserving existing review exploration behavior unless the user enables analysis.
- Cancel or supersede stale searches when the position changes; clearly handle engine unavailability and bounded search limits.
- Reuse ReplayBoard and the existing wooden board/piece assets throughout.

Decisions before implementation: engine execution/reuse, depth/time controls, starting-position input, variation saving, and when analysis is available during practice/play. Avoid circular dependencies by building the shared analyzer and standalone page before dependent integrations.

Verification: top-three results from representative positions, fewer-than-three moves, mate/terminal positions, both evaluation perspectives, manual branches and navigation, rapid position changes, and each integrated entry point.


Implementation audit (2026-10-08): the existing `/analysis`, shared position panel, streamed endpoint, opening-editor integration, and review/exploration integration already provide the requested MultiPV candidates, legal SAN continuations, White-perspective numerical/mate/bounded evaluations, evaluation bar, progress/depth, 1/3/8-second presets, manual play/navigation/FEN input, cancellation, and stale-result handling. TASK-046 now adds Stockfish-play integration through explicit paused-play assistance; opening practice retains concealed suggestions. Standalone variations remain temporary. Existing unit/component checks and live MultiPV checks passed, including both colors, one/two/three candidates, mates, and cancellation.


### TASK-048 — Record Millennium King Performance games through ChessLink

Status: IN PROGRESS — experimental recorder implemented; real-board feasibility/acceptance pending
Priority: P2 (proposed; user has not ranked this against TASK-046–047)
Dependencies: user’s M830 King Performance and ChessLink hardware for validation; existing authenticated game import/library/review, chess.js, and shared ReplayBoard. TASK-047 is optional for deeper post-game analysis, not a prerequisite for recording.

Goal: play against the King engine built into the physical chess computer, record both sides’ moves in this app, and save the completed game as a new private entry in My Games for existing review/analysis. Avoid the current difficult PC transfer workflow. The King remains the opponent; the app acts as a recorder.

Feasibility findings (2026-10-08):
- Chessconnect lists M830 King Performance with M822 ChessLink as supported over Bluetooth LE and USB serial. This establishes a transport precedent, but does not establish passive recording during built-in King play.
- Millennium’s expert manual describes CLink as a separate mode for online opponents/external engines; MOVE exits that mode. Its app manual also requires CLink mode. Whether normal King play exposes live moves over ChessLink is unverified and is the critical feasibility gate. Do not promise simultaneous King-engine play and Bluetooth recording based on online compatibility alone.
- The manual describes nine manually managed save slots, not an automatic archive of the last nine games. It documents PC game transfer through USB. Bluetooth access to those slots is unverified and separate from receiving live board events.
- Web Bluetooth can access BLE GATT services in supported browsers and requires a secure context and a user-triggered device chooser. Plan an initial desktop Chrome target on the user’s OS, detect capabilities at runtime, and document tested browser/OS combinations. Local development can use a trustworthy localhost origin; remote access needs HTTPS. A server cannot pair with the user’s board through this browser API.
- The app already accepts legal PGNs, custom starting FENs, and unfinished result `*` through `POST /api/games`. Reuse this authenticated import path and existing review flow rather than introducing another saved-game format.

Phase 1 — hardware/protocol investigation:
- Record the exact board/ChessLink model, firmware versions, user OS/browser, cabling, and normal-play versus CLink settings. Disconnect Chessconnect/other board clients during testing.
- Identify and document BLE service/characteristic UUIDs, write/notification behavior, command framing, checksums if present, and event meaning using authoritative protocol material or a suitable licensed implementation. Do not assume another Millennium model’s piece-recognition behavior applies to the M830.
- Test whether the browser can observe both the human move and the physically executed King reply while the built-in engine continues operating. Determine whether events contain moves, piece positions, or only square/pressure changes; check captures, castling, promotion, orientation, and takebacks.
- Determine which initialization/subscription commands are required and whether any change engine mode, reset the board, or interfere with King LEDs. Use only commands proven compatible with recording.
- Produce a short feasibility report with a minimal connection/event probe, sanitized captured fixtures, exact reproduction steps, and a go/no-go decision. BLE pairing alone does not pass this gate; require a short game against the built-in King with an accurate recorded move sequence.
- If simultaneous recording is unsupported, document the hardware restriction and propose a separately scoped fallback: USB/Web Serial or a local bridge only if the relevant protocol can meet the goal, importing exported PGN, or guided replay of a stored game if verified. A different transport does not by itself resolve a mode restriction. Preserve the built-in-King requirement and confirm a changed workflow before implementing the fallback.

Phase 2 — recorder MVP, conditional on Phase 1 passing:
- Add a clear connection/recording entry point with Connect, Start recording, Pause, Reconnect, Finish, and Discard controls. Select user color, board orientation, player names, and date; default the opponent name to “The King Performance”. Start with standard chess from the normal initial position, and verify physical/digital synchronization before recording.
- Show connection state, the current position, legal SAN move list, and the last accepted move. Reuse ReplayBoard plus boardTheme/customPieces and the existing wooden board/piece images. Keep engine suggestions out of the recording screen by default so the physical King game can be reviewed afterward.
- Normalize hardware events into a legal chess.js move sequence. Handle fragmented/duplicate messages, temporary square changes, captures, castling in either piece order, en passant, and promotions/underpromotions. Ask for the promotion piece if the protocol cannot identify it; never silently assume a queen. Commit only a fully resolved legal move; pause and request correction when events are ambiguous or inconsistent.
- Support confirmed takebacks by restoring the matching earlier position and truncating the active line. Physical piece adjustments must not silently alter the game history. Manual correction requires an explicit user action and subsequent board synchronization.
- Preserve a recoverable local draft after every accepted move and across reload/disconnection, scoped to the signed-in account and cleared on discard/successful save. Warn when draft persistence fails. Resume only after reconciling the physical board with the last confirmed position; if moves were missed, request reconstruction or save the known partial game rather than inventing history. A final board position cannot generally reconstruct missing moves.
- Finish explicitly and confirm result/termination, including resignation, agreed draw, or unfinished `*`. Detect checkmate/stalemate and offer the corresponding result; do not infer resignation, clock loss, or an agreed/claimable draw from sensor events. Produce consistent PGN headers/movetext, offer PGN download, and save through the existing import flow with user ownership. Save creates a new game; it does not overwrite an existing game. Preserve the draft on save failure and prevent duplicate creation from repeated Save/retry actions.
- Handle cancelled/denied pairing, unavailable Bluetooth, another active board client, malformed events, device power loss, tab sleep, and reconnect with actionable messages. Release connections/listeners when finished. Explain that capture requires an active connected browser and cannot recover games played before recording began.

Separate possible extension: retrieve an existing game from one of the nine King save slots. Investigate the documented USB export protocol and any supported Bluetooth equivalent independently. Do not include direct slot download in the MVP or claim it is possible without hardware evidence. Custom starting positions/FEN and broader board/browser support are later extensions.

Acceptance:
- Real hardware demonstrates a complete normal-start game against the built-in King, recording both sides accurately without switching the opponent to an external engine.
- Both user colors/orientations and special moves record as legal PGN; intermediate/duplicate events do not create extra moves; unresolved input pauses visibly.
- Disconnect/reload preserves the draft and reconnection detects mismatches/missing moves; takeback and explicit correction preserve a valid history.
- A finished or partial game can be downloaded as PGN and saved once into the owner’s My Games, then opened through existing review/analysis. Failed saves retain the recording; other accounts cannot access it.
- Unsupported environments and competing connections produce clear recovery guidance; every chessboard retains the shared wooden appearance.

Decisions before implementation: confirm the exact hardware/firmware and OS/browser; establish simultaneous King-play observation; settle event interpretation and safe initialization; choose the recorder’s navigation location and local-draft retention limits. Hardware validation requires the user’s board; automated mocks cannot establish physical compatibility. The user authorized an implementation attempt on 2026-10-08; the physical-board gate remains required before marking DONE.

Verification: protocol decoder/state-machine tests from captured fixtures; mocked chooser/connection/error tests; browser journeys for recording, draft restore, save/retry, and ownership. Real-board checks for both colors, rotation, captures, castling, en passant, all promotion types, takebacks, power loss, tab sleep, reconnect with missed moves, and a complete game imported and reviewed. Mark DONE only after the hardware acceptance gate passes.

Research references:
- [Chessconnect’s Millennium compatibility](https://chessconnect.de/millenium-boards/)
- [Millennium M830 expert manual, sections 5.7, 5.10, and 6](https://computerchess.com/media/71/6d/c8/1648808903/M830_expert-manual_ENG.pdf)
- [Millennium ChessLink app manual](https://computerchess.com/media/57/9b/9b/1749546201/250610_ChessLink-App_manual_ENG.pdf)
- [Chrome Web Bluetooth documentation](https://developer.chrome.com/docs/capabilities/bluetooth)
- [python-mchess protocol implementation reference](https://github.com/domschl/python-mchess) — primarily targets Exclusive/eONE; inspect licensing and verify M830 applicability before reuse.

Implementation attempt (2026-10-08): added authenticated `/games/record` and a My Games entry point. Direct Web Bluetooth uses the reference transparent-UART characteristics, serialized non-mutating version/status queries, fragmented-frame decoding/checksums, and full-placement legal move matching. Default move confirmation, optional automatic acceptance, both colors/rotation, pause/reconnect, confirmed takebacks/manual reconstruction, account-scoped local draft recovery, explicit finish/result, diagnostics and PGN downloads are available. Games save through the existing owner-checked PGN import/review flow. A fixed snapshot plus owner-derived deterministic game ID makes save retries/concurrent requests idempotent without a database migration. No physical M830/ChessLink was available: received format, normal-King-mode visibility, and complete hardware special-move behavior remain unverified. Direct saved-slot retrieval is not implemented. See `lib/chesslink/README.md` for the hardware acceptance procedure.

Software verification (2026-10-08): all 595 unit/component tests passed; focused recorder/import checks passed again after browser fixes. TypeScript and lint passed. Two Chromium journeys at 1200px/390px passed using simulated GATT notifications and the dedicated PostgreSQL test database, including legal recording, disconnect/reload recovery, terminal result, PGN download, owned save/review, repeated-save idempotence, and unauthenticated/cross-user denial. Desktop/mobile screenshots were visually reviewed with no horizontal overflow. Webpack production build passed. These checks establish software behavior only; the physical-board acceptance gate remains open.

Hardware follow-up (2026-10-08): user reports successful Bluetooth connection but no recorded moves and a permanently disabled Start recording button. Physical compatibility remains unconfirmed. Added explicit recording-gate explanations distinguishing no position response, received-but-unsupported data, stale status, and mismatched placement. Diagnostics now include outgoing version/status queries plus firmware, packet count, rotation, expected/reported placement, and gate state, without account/player identifiers. A connection does not bypass synchronization. Focused decoder/lifecycle/recorder tests, TypeScript and lint passed; actual response bytes and board mode are still needed to identify the hardware failure.

Square-order correction (2026-10-08): user supplied a normal starting position reported as `RNBKQBNR/PPPPPPPP/8/8/8/8/pppppppp/rnbkqbnr` and confirmed the physical board is not rotated. The recorder now calibrates forward/reversed incoming square order against the complete known recorded position before starting, locks the mapping for the connection, and applies it to later moves. The checkbox is renamed “Reverse ChessLink square order”; it no longer claims the physical board is rotated. The existing draft flag is retained for compatibility. A regression test reproduces the exact supplied report, enables Start recording, and records a subsequent reversed-order e4 correctly.

Square-order verification: 18 focused decoder/lifecycle/recorder tests, TypeScript, lint, and both Chromium journeys passed. The desktop journey uses forward reports; the mobile journey uses reversed reports through initial synchronization, recording, disconnect/reload recovery, save/retry, and review. Physical move validation remains pending user testing.

Live logging (2026-10-08): user requested logs when making physical moves. Added a timestamped Live board activity panel with changed-square details, calibrated square order, detected SAN/UCI moves, confirmation/acceptance, and recording-pause reasons. Position changes are logged even while paused, without altering history; repeated identical positions are omitted. The latest raw packet and packet count remain inspectable, while a combined activity/diagnostics download preserves up to 100 activity events and the existing bounded transport log. Logs stay local and exclude player/account identifiers.

Real-trace synchronization fix (2026-10-08): user's uploaded diagnostics for `1. d4 e6 2. e4 d5` contain correctly decoded reversed-order positions, including separate departure and destination presses. The session has no Recording started event and remains paused throughout, so moves were observed but intentionally not recorded. The trace also exposes departure-only states lasting roughly 1–1.6 seconds; these previously caused recording to pause after the 800 ms debounce. Added legal-move intermediate-position recognition so recording stays active while pieces are being moved. Moved Start/Resume/Pause/Confirm controls into the connection panel with explicit recording-state instructions. Added user-supplied SAN move recovery, validated against a fresh physical placement and existing recorded prefix, so the played sequence can be restored without resetting the board. Added sanitized real-frame fixtures and regression tests for all four moves, slow presses, and recovery. This confirms incoming move visibility in the user's tested setup; the diagnostics do not identify the King mode, so simultaneous built-in-engine play is not independently established yet.

Real-trace fix verification: 23 focused decoder/lifecycle/recorder tests passed, including the actual captured d4/e6/e4/d5 frames, departure-only states lasting longer than debounce, automatic recording, and matching-position SAN recovery. Both desktop/mobile Chromium journeys passed with slow pressure-board steps, reconnect/reload, missed-move recovery, PGN export, owned saving/retry and review. TypeScript, lint, and webpack production build passed.

Automatic recording default (2026-10-08): user confirmed recording now works but requested removing per-move confirmation. Automatic acceptance is now enabled by default for each recorder session; confirmation remains an explicit troubleshooting option. Tests retain both modes, with the real d4/e6/e4/d5 trace asserting the automatic default and browser journeys updated to verify moves synchronize without Confirm clicks.

TASK-048 LED hardware feedback (2026-10-08): user confirmed King LED prompts work in listen-only mode, after initial-query mode failed to preserve prompts. Listen-only is now the default in both recorder and transport. Initial queries remain an explicit troubleshooting option. This establishes LED behavior on the user’s board, not which of V/S caused the interference or complete special-move acceptance.

TASK-048 follow-up: user reports moves do not sync in listen-only mode. LED-only success does not meet recording acceptance. Added independent manual V/S queries while paused to diagnose initialization without bundling queries or changing EEPROM/LED settings. Hardware diagnosis remains pending.


### TASK-049 — Beat your past self

Status: DONE — tactical first release implemented on 2026-10-09
Priority: P1
Dependencies: existing personal puzzle generation/practice and game review

Scope: [implementation plan](BEAT_YOUR_PAST_SELF_PLAN.md). The user authorized implementation after requesting the plan. `/replay` offers game-specific or all-games practice using existing validated personal puzzles. Review and puzzle-library entry points are available. Sessions select up to five distinct starting positions, preferring unseen, then unsuccessful/assisted, then solved challenges. Repeat practice has independent saved attempts; existing puzzle completion is untouched.

Implementation: owner-scoped sessions, server-side immutable solution/source/coaching snapshots, legal full-sequence grading with automatic opponent replies, hints/reveal/retry/skip, reload resume, recent sessions, and outcome totals. Original move, first legal attempt, validated solution, saved coaching when available, original-position inspection, and exact source-review navigation appear only after solving/revealing. Before reveal, DTOs omit solutions, coaching, original moves, source IDs/plies, and original puzzle IDs. Illegal moves do not count; first-try means a full unassisted sequence without incorrect legal moves. Request IDs and revision checks protect repeated/stale writes, and database row locks serialize simultaneous starts/actions. Source-game deletion cascades to challenge snapshots and their move-action history. All boards reuse the existing wooden theme.

Design: prepared [responsive desktop/mobile preview](designs/beat-your-past-self.html) before UI implementation and shared it in the session. Open Design was unavailable; implementation followed existing app styling. Desktop/mobile browser screenshots were visually inspected. This is the existing conservative tactical policy, not arbitrary positional/defensive improvement grading, a rating estimate, or spaced repetition. Starting practice makes no AI or engine calls; explicit existing puzzle generation remains necessary.

Verification on Node 24.21.0: lint, typecheck, all 676 unit/component tests, 14 targeted integration tests (7 session tests plus 7 existing puzzle tests), and webpack production build passed. Integration checks cover selection priorities/five-position cap/deduplication, fresh repeated attempts, unchanged original progress, hidden answers, legal/illegal moves, retry history, hints/reveals/skips, full-sequence completion, explicit underpromotion, concurrent/duplicate/stale actions, owner isolation, immutable snapshots, and game-deletion cleanup. Both final Chromium journeys passed (White desktop and Black at 390px), covering empty-library feedback, review entry, multi-move solving/reload, pre-reveal responses, comparison/original-board inspection, results, new-session navigation, and unauthenticated/cross-user API denial. Existing White/Black puzzle browser journeys also passed in an earlier combined run. Corrected a read-only-board test selector and made the new signup helper respect the existing rate limit; final browser checks passed. No live AI calls or new live-engine validation is claimed. Existing unrelated release blockers remain separate.

Both additive migrations were applied successfully to the isolated test database and configured local `chess_coach` database; the Prisma client was regenerated. README includes entry points, grading, eligibility, persistence, and update instructions.
