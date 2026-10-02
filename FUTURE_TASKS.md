# Chess Coach — future development backlog

Source: [original ideas](CHESS_COACH_FUTURE_SPECS.md). Existing V0.1 work and evidence remain in [TASKS.md](TASKS.md).

This backlog is not authorization to implement every task. The user authorized email/password auth and ownership (TASK-029–030) and review exploration (TASK-028), then requested starting the next tasks on 2026-10-01. TASK-031–032 are implemented. The user requested TASK-033 on 2026-10-02; it is now implemented too. TASK-034 onward remain TODO. IDs continue after TASK-027; dependencies and the recommended sequence determine implementation order. Resolve a task's open decisions before implementing that task. Record implementation evidence before marking it DONE.

## Priority and sequence

- **P1:** next useful capabilities and foundations.
- **P2:** learning-library expansion after the core practice workflow.
- **P3:** features that depend on learning content or a public launch.

Recommended sequence: **029 → 030 → 028 → 031 → 032 → 033 → 034 → 035 → 036 → 037 → 038 → 039 → 040 → 041**.

The app is for personal use initially, but accounts and data ownership come first by user decision so future multi-user use is handled now. Complete TASK-029–030 before the other new features. The landing page remains later; it can move earlier if public launch becomes a priority.

TASK-026 is still BLOCKED by existing release acceptance requirements. Track it separately; new planning does not resolve its missing live coaching evidence or build decision. Public deployment is a separate scope decision, not an implied part of adding login or a landing page.

## Confirmed decisions

1. Personal use first, with authentication and user ownership implemented now for future growth.
2. Review-board Reset returns to the exploration starting position.
3. Learning exercises are added manually. PDFs have a separate `/books` page; learning does not depend on PDF import or extraction.
4. Email/password login only initially. Keep user identity independent of credentials so Google can be added later through explicit account linking.
5. Review exploration uses manual play for both sides without live engine evaluation (confirmed for TASK-028).

## Remaining implementation decisions

Before the affected implementation, also settle: browser-local versus synchronized PDFs; who authors lessons; and whether weekly plans are reusable templates or dated schedules.

TASK-031 started with one-move puzzles; TASK-033 extends new generation to at most three solver moves (five total plies). Remaining defaults are proposals, not confirmed preferences: browser-local PDFs; editable weekly plan templates without calendar integration. Automatic PDF diagram/solution extraction is outside the agreed learning scope.

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

Status: TODO  
Priority: P2  
Dependencies: TASK-030

Reference: `/Users/aljaz/Desktop/Chess Books/index.html`. Read-only inspection found PDF.js rendering, IndexedDB PDF storage, localStorage metadata, last-page progress, thumbnails, and per-page checkmarks.

Scope: adapt the reader into a separate `/books` page, preserving import/library, navigation, reading position, and checkmarks. Confirm local-only versus account-synchronized storage before implementation. PDFs are separate from manually authored learning exercises.

Acceptance:
- Import and reopen a PDF, resume reading, add/remove marks, and remove a book without affecting others.
- Report invalid files/storage failures; support responsive and keyboard navigation.
- Explain the storage boundary. Existing standalone browser data does not automatically transfer between origins; provide a documented re-import path and decide whether progress export/import is needed.
- Account switching does not expose another user's PDFs on a shared browser if accounts are enabled.

Verification: reader interaction and browser persistence checks with small sample PDFs. Automatic puzzle extraction is separate scope.

### TASK-035 — Build the learning library and chapter structure

Status: TODO  
Priority: P2  
Dependencies: TASK-030

Scope: `/learning`, material detail, ordered chapters, and manually added chapter exercises. Support examples such as Mate in 1 and Mate in 2. This workflow is independent of the PDF reader at `/books` and requires no PDF import or extraction.

Acceptance:
- Users can navigate material → chapter → exercise and return with context preserved.
- Store stable material/chapter/exercise IDs and distinguish shared curated content from private material.
- Define a manual authoring workflow for exercise positions, prompts, solutions, and chapter assignment, with validation before saving; include a small original or authorized sample set rather than assuming a named book's contents are available.
- “Find Missing Piece” is identified as a separate exercise type with its own rules, not forced into ordinary legal-move puzzles.

Verification: ordering/navigation, empty materials, content visibility, and stable references.

### TASK-036 — Practice chapter exercises and track progress

Status: TODO  
Priority: P2  
Dependencies: TASK-032, TASK-035; TASK-033 for multi-move exercises

Scope: reuse the puzzle solver for move-based chapter exercises, add resume/retry, and show per-chapter/material progress.

Acceptance:
- Persist progress per user and exercise; repeated solves do not inflate completion totals.
- Keep reading progress separate from solved-exercise progress and preserve assisted outcomes.
- Resume the next unfinished exercise after refresh/sign-in; define how content revisions affect completion.

Verification: partial/completed chapters, repeat attempts, content revision, reload, and user isolation.

### TASK-037 — Add “Find the missing piece” exercises

Status: TODO  
Priority: P2  
Dependencies: TASK-035, TASK-036

Scope: define whether the learner chooses a piece, a square, or both; implement an exercise-specific prompt, authoring schema, answer validation, and progress reporting.

Acceptance:
- The prompt makes the required answer explicit and supports every authored valid answer.
- Piece placement uses its own interaction mode, preserving legal-move behavior in review and tactical puzzles.
- Hints, reveal, retry, and completion integrate with chapter progress.

Verification: correct/incorrect placements, multiple valid answers, and progress persistence.

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
