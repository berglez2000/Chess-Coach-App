# Chess Coach — future development backlog

Source: [original ideas](CHESS_COACH_FUTURE_SPECS.md). Existing V0.1 work and evidence remain in [TASKS.md](TASKS.md).

This backlog is not authorization to implement every task. The user authorized email/password auth and ownership (TASK-029–030) and review exploration (TASK-028), then requested starting the next tasks on 2026-10-01. TASK-031–032 are implemented. The user requested TASK-033 and TASK-034 on 2026-10-02; both are now implemented. On 2026-10-03 the user requested refinement of TASK-035–037 around their supplied book exercise and future PDF extraction, then authorized starting implementation. TASK-035–036 are now implemented; TASK-037 onward remain TODO. IDs continue after TASK-027; dependencies and the recommended sequence determine implementation order. Resolve a task's open decisions before implementing that task. Record implementation evidence before marking it DONE.

## Priority and sequence

- **P1:** next useful capabilities and foundations.
- **P2:** learning-library expansion after the core practice workflow.
- **P3:** features that depend on learning content or a public launch.

Recommended sequence: **029 → 030 → 028 → 031 → 032 → 033 → 034 → 035 → 036 → 037 → 038 → 039 → 040 → 041**. **TASK-042 can start after TASK-035–036**, independently of TASK-037 for supported move-based chapters and independently of the weekly-plan/public-launch tasks.

The app is for personal use initially, but accounts and data ownership come first by user decision so future multi-user use is handled now. Complete TASK-029–030 before the other new features. The landing page remains later; it can move earlier if public launch becomes a priority.

TASK-026 is still BLOCKED by existing release acceptance requirements. Track it separately; new planning does not resolve its missing live coaching evidence or build decision. Public deployment is a separate scope decision, not an implied part of adding login or a landing page.

## Confirmed decisions

1. Personal use first, with authentication and user ownership implemented now for future growth.
2. Review-board Reset returns to the exploration starting position.
3. The initial learning workflow uses manually added exercises and remains usable without PDF extraction. PDFs retain their separate `/books` page. The user wants future automated diagram/solution extraction into the learning database; TASK-042 records that follow-up.
4. Email/password login only initially. Keep user identity independent of credentials so Google can be added later through explicit account linking.
5. Review exploration uses manual play for both sides without live engine evaluation (confirmed for TASK-028).
6. PDFs, reading progress, and positioned checkmarks are stored in PostgreSQL and synchronized through the owning account (confirmed for TASK-034 on 2026-10-02).

## Remaining implementation decisions

Before TASK-037 implementation, inspect a user-supplied Missing Piece example and its solution to establish the required placement and objective. Before TASK-039, settle whether weekly plans are reusable templates or dated schedules.

TASK-031 started with one-move puzzles; TASK-033 extends new generation to at most three solver moves (five total plies). The refined learning tasks below specify implementation defaults: account owners author private material; shared curated content has operator-controlled publication; answer-changing revisions require fresh completion while retaining history. These defaults are planning choices, not claims of separately confirmed user preferences. Editable weekly plan templates without calendar integration remain a proposal. Automatic PDF diagram/solution extraction is planned separately under TASK-042 and is not required to complete TASK-035–037.

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

Verification: the checks under TASK-035 passed. Unit fixtures cover the supplied mate, multiple immediate solutions, forced Mate in Two/Three, the at-most-four mate bound with promotion, a seven-ply authored sequence, rejection of cooperative mating lines, bounded-search failure, branch legality/conflicting replies, and preserved legacy limits. Integration checks cover completion/reload, assistance/reveal/retry, simultaneous duplicate delivery, stale revisions, pinned earlier attempts, new-answer completion reset, presentation-only identity, archives, and private progress for shared content. Both learning Chromium journeys passed actual board clicks, wrong answers, reload, assisted/unassisted completion, chapter resume/totals, and history. Existing White desktop and Black 390px personal-puzzle Chromium journeys also passed. A combined run encountered the existing signup rate limit; running learning and puzzle suites separately resolved the test issue without changing authentication. No live engine/provider acceptance or PDF extraction is claimed; TASK-026/037/042 remain separate.

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

Status: TODO  
Priority: P2  
Dependencies: TASK-029, TASK-030

Scope: roughly ten short profile questions covering rating/experience, goals, weaknesses, available days/minutes, preferred activities, and learning resources. Let users edit their answers.

Acceptance:
- Optional or unknown rating is supported; time budgets and availability are validated.
- Save answers per user and show a review step before generating a plan.
- Record which answers informed each future plan without overwriting prior plan inputs.

Verification: incomplete survey, invalid availability, editing, persistence, and user isolation.

### TASK-039 — Generate an editable weekly learning plan

Status: TODO  
Priority: P3  
Dependencies: TASK-038, TASK-036

Scope: use the selected AI provider to propose sessions for tactics, own-game puzzles, lessons, endgames, and review based on the survey and available material. Default proposal: reusable weekly template.

Acceptance:
- Validate structured output, time totals, available days, and referenced content IDs before saving.
- Never invent an available book/chapter or promise measured improvement; generic activities are labeled as such.
- Preview, edit, accept, and explicitly regenerate a plan; errors preserve the last accepted plan.
- No automatic paid calls on page load; record provider/model and the inputs used.

Verification: deterministic provider fixtures for invalid schedules, nonexistent resources, timeout, edits, and regeneration. Record a separate live acceptance check when configured.

### TASK-040 — Follow the plan and record weekly completion

Status: TODO  
Priority: P3  
Dependencies: TASK-039

Scope: show this week's sessions, link to their activities, and support complete/skip/reschedule with weekly progress. Snapshot template sessions into dated weeks so recurring use has distinct history.

Acceptance:
- Edits/regeneration do not erase completed history; week boundaries use the user's selected timezone.
- Reading and offline study can be manually completed; defined exercise targets can use recorded attempts.
- Prevent duplicate completion and preserve progress across sessions.

Verification: week rollover, rescheduling, repeated completion, and plan replacement. Automatic adaptive replanning, reminders, and calendar integration are future scope.

### TASK-041 — Add the public landing page and app entry flow

Status: TODO  
Priority: P3; raise to P1 for public launch  
Dependencies: TASK-029 and TASK-030 for registration/sign-in calls to action

Scope: modern responsive page explaining review, practice, and learning with accurate screenshots/examples and clear entry actions. Propose `/` for the landing page and `/dashboard` for the existing dashboard; confirm this route choice before implementation.

Acceptance:
- Visitors can understand available features and enter registration/sign-in; signed-in users can reach their dashboard directly.
- Preserve existing game/review URLs and update internal dashboard links.
- Upcoming capabilities are labeled accurately; layout works on mobile and with keyboard navigation.

Verification: anonymous/signed-in navigation, route redirects, responsive layout, and accessibility checks. Hosting, pricing, subscriptions, and payments are not included in this task.

### TASK-042 — Build an automatic PDF-to-exercise import pipeline

Status: TODO
Priority: P2
Dependencies: TASK-035, TASK-036

Requested (2026-10-03): create a pipeline that automatically adds positions and matching solutions from the user's PDF book to the learning database. This expands the existing PDF-extraction placeholder into an implementation task; implementation has not started.

Scope: select an owned PDF from `/books`, a target private learning material, and diagram/answer page ranges; automatically identify chapters and numbered exercises, reconstruct board positions as FEN, match published solutions, validate them, and persist exercises using the authoring/revision system from TASK-035 and the correctness policy from TASK-036. Preserve the book's exercise numbers, chapter structure, titles/prompts, and published answers. Use the existing TASK-034 PDF storage/rendering, including compressed diagram decoding. PDF reading progress remains separate.

Initial delivery: import a small representative batch of Mate in One exercises from `1001 chess exercises for beginners`, including their answer pages, then extend to the supported move-based chapters and whole-book batches. The user-supplied exercise 1 is the first known reference position/solution. Missing Piece exercises are identified and reported as unsupported until TASK-037 is implemented; they do not block importing supported chapters.

Pipeline:
1. **Start a durable import job:** record the owning user, source PDF identity/digest, target material, selected page ranges, extraction configuration/version, and explicit processing limits. Return a job ID and progress rather than holding one browser request open for the entire book.
2. **Find chapters and exercises:** extract available PDF text; render pages/crop diagrams for visual recognition when needed. Detect exercise numbers, titles/prompts, chapter membership, board coordinates/orientation, and diagram bounds. Keep PDF page indices distinct from printed page labels.
3. **Reconstruct positions:** recognize every occupied square and piece color/kind, build a piece map and FEN, and obtain side to move/objective from the diagram or chapter instructions. Castling/en-passant state requires source evidence or an explicit confirmed chapter/import setting; unresolved state is flagged rather than silently invented.
4. **Match book answers:** locate the corresponding answer pages, associate solutions by book/chapter/exercise identity, parse SAN and published variations, and retain the source answer text separately from accepted practice branches. Detect missing, duplicate, or ambiguous matches.
5. **Validate and persist:** reuse server-side position/solution/objective validation. Automatically create owner-scoped exercise drafts with provenance, diagram evidence, extraction confidence/issues, and validation results; mark successful drafts validated. Failed or inconclusive extraction/validation must remain reviewable and cannot be presented as a correct playable exercise.
6. **Review and publish:** show source diagrams beside reconstructed boards and matched answers, allow corrections/revalidation, and provide batch publication of validated exercises. Initially, the owner explicitly approves publication; automatic insertion into the database does not require manual entry of every exercise. Fully unattended publication is a later decision informed by measured extraction accuracy.

Acceptance:
- One explicit import action processes the chosen batch through extraction, solution matching, validation, and database insertion. The UI reports discovered, extracted, validated, review-needed, published, skipped/unsupported, and failed counts with reasons and source-page links.
- Newly created chapters/exercises preserve book ordering and stable internal IDs. Chapter-title proposals and inferred boundaries are reviewable; no silent reassignment of existing authored exercises.
- Source records include PDF identity, diagram/answer page indices and printed labels when available, diagram bounds/evidence, exercise reference, extraction method/model/version, applicable chapter assumptions, and validation method/evidence. Do not fabricate absent titles, prompts, page labels, or answers.
- Every imported solution is checked for legal transitions and the stated objective using TASK-036. AI/recognition confidence alone cannot establish correctness. Mate-proof search limits remain explicit; an import cannot bypass publication validation because the answer came from a book.
- Retries, duplicate submissions, resumed jobs, and re-imports do not create duplicate exercises. Use owner, material/source identity, chapter/exercise reference, and versioned extraction identity to distinguish reprocessing from a genuinely different source. Never overwrite manually corrected content or published answers silently; proposed replacements require explicit review and create revisions while preserving progress/history.
- Jobs persist stage/checkpoint and per-exercise outcomes. Support bounded batches, progress polling, cancellation, retry of failed items, and restart recovery. Lease/token fencing or equivalent safeguards prevent stale workers from publishing results after cancellation or supersession. Partial success remains available without misreporting the batch as fully imported.
- PDF access, job status/results, draft editing, and publication enforce account ownership on the server. Importing a private book does not share its exercises, source images, or PDF with other users.
- Extraction runs only after an explicit action. Define and display any external PDF/image processing and applicable provider/model, maximum pages/items, concurrency, timeout, and cost budget before starting. No paid calls occur on page load; provider failures preserve saved drafts and existing learning content.
- Keep extraction compatible with the existing authoring schema and draft/validated/published lifecycle. Deleting a source PDF does not delete imported exercise definitions or completion history; source links report unavailable evidence honestly.

Decisions before implementation:
- Inspect representative diagram and answer pages from the actual PDF to choose text extraction, local recognition, vision-provider processing, or a combination. Do not assume that every diagram directly contains an extractable FEN.
- Select the first batch/page ranges and target material, and confirm any book-wide side-to-move/castling/en-passant assumptions that the source leaves unstated.
- Set the extraction provider/local tooling and processing/cost limits. Initial batch approval remains the publication default; changing to unattended publication requires a defined quality policy.

Verification: a small end-to-end batch containing the supplied `Rxa6#` example plus manually checked additional diagrams and matched answer pages; compare extracted FEN, solver, chapter/number, and solution with that checked reference set. Include both colors where available, multiple diagrams per page, compressed diagrams, wrong orientation/piece recognition, repeated numbers across chapters, ambiguous/missing answers, unsupported types, validation/search-limit failures, provider timeout, cancellation/restart, stale workers, retries/re-import deduplication, manual corrections, answer revisions, and two-user isolation. Run a browser journey PDF selection → import progress → draft comparison/correction → batch publication → chapter practice with saved completion. Report observed accuracy, counts, costs when applicable, and unresolved cases before scaling to the full book.
