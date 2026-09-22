# Chess Coach — V0.1 development tasks

Source of truth: [CHESS_COACH_V0.1_SPEC.md](CHESS_COACH_V0.1_SPEC.md).

V0.1 delivers **select color → import PGN → save → analyze with Stockfish → generate validated coaching → review the game**. Puzzles, training, recurring-weakness statistics, authentication, and deployment are deferred. The import form has exactly three controls: White/Black selector, PGN textarea, and submit button.

## Working rules

- After completing and verifying a requested task, commit and push its changes before starting another task.
- All tasks start as TODO. Implement only the requested task; do not automatically start the next one.
- Read the specification, this backlog, applicable repository instructions, and relevant existing files before editing. Preserve user changes.
- Dependencies list prerequisite tasks, not permission to implement them. Work in numerical order by default; independent tasks may be scheduled after their dependencies are done.
- Set IN_PROGRESS when implementation starts. Mark DONE only after acceptance criteria pass and verification evidence is recorded in Notes. Use BLOCKED with a concrete reason if an acceptance criterion cannot be completed.
- Each task includes tests for its behavior. Final hardening adds coverage across the complete workflow; it does not defer core testing until the end.
- Choose package versions and verify current vendor documentation during implementation. This backlog deliberately does not pin versions or an OpenAI model.

## Verification conventions

**Standard checks** means `npm run lint`, `npm run typecheck`, and `npm test`, after running the narrow relevant tests during development. TASK-001 establishes lint/typecheck; TASK-002 establishes the non-watch test command.

Additional planned scripts are introduced by their owning tasks: `test:integration` in TASK-007, `test:engine` in TASK-010, and `test:e2e` in TASK-025. These commands do not exist yet. Database suites use an isolated test database. Fast automated tests use explicit mocked engine/AI adapters and never make paid API requests. Build checks use `npm run build`; setup details follow the README as it is created.

## Milestone overview

| Milestone | Tasks | Demonstrable outcome |
|---|---|---|
| M0 — Bootstrap | 001–003 | App starts; checks run; local PostgreSQL is reachable. |
| M1 — PGN to board | 004–006 | Select color, paste a PGN, and replay every move. |
| M2 — Game library | 007–009 | Saved games survive restart and have stable review URLs. |
| M3 — Stockfish | 010–015 | Engine-backed review works without AI. |
| M4 — AI coach | 016–020 | Validated coaching is saved, synchronized, and retryable. |
| M5 — Review polish | 021–023 | Responsive review, positive highlights, and recovery are coherent. |
| M6 — Release hardening | 024–026 | Minimal dashboard and verified, documented local workflow. |

## Planning defaults

- A selected move displays its resulting position (`fenAfter`); ply 0 displays the actual initial position. Alternatives originate from `fenBefore` and must be labeled accordingly. TASK-006 records this convention and later tests enforce it.
- The selected user color is required and persisted; it drives orientation and coaching. No username inference or extra import fields are needed.
- The PGN parser supports one game per import. Parser-supported setup positions are replayed from their FEN; unsupported input is rejected clearly.
- M1 uses temporary parsed state; M2 replaces that path with persistence. The button becomes **Import and Analyze** when TASK-019 connects the full flow.
- Engine data is committed before coaching. AI-only retries reuse it. Run protection and interrupted-run recovery are part of the local workflow.
- If implementation reveals a concrete blocker to a planning default, explain and record the decision before changing it.

## Task backlog

### TASK-001 — Bootstrap the local application

Status: DONE
Milestone: M0  
Dependencies: None

#### Description

Create the Next.js App Router application with TypeScript, Tailwind, and npm while preserving the specification and task backlog.

#### Scope

- Select current stable, compatible packages at implementation time and record the supported Node.js version.
- Add a minimal home page and application layout; configure lint and typecheck scripts.
- Add a lockfile, .gitignore, and a names-only .env.example for the variables in the specification; start the README.

#### Out of scope

Product screens, database access, engine execution, and AI calls.

#### Acceptance criteria

- The home page loads locally and the production build succeeds.
- Environment files containing secrets and generated artifacts are ignored; .env.example remains trackable.
- Existing planning documents are preserved.

#### Verification

- npm install
- npm run dev — open the home page.
- npm run lint
- npm run typecheck
- npm run build

#### Notes

Completed the manual Next.js bootstrap while preserving the existing Git repository and specification. Package versions, Node 24 setup, and compatibility decisions are documented in README.md. Next.js generated AGENTS.md and CLAUDE.md on first development startup; these point to its bundled version-matched documentation.

Verification passed using Node 24.21.0 and npm 10.8.2:

- Dependency installation completed and package-lock.json was generated; npm reported zero vulnerabilities.
- `npm run lint`, `npm run typecheck`, and `npm run build` passed.
- `npm run dev` served `/` with HTTP 200 and the expected title, heading, content, and stylesheet.
- An ad hoc browser smoke check passed at 1280×800 and 390×844: CSS applied, no horizontal overflow, home link worked, and no page errors occurred. Existing local browser tooling was used without adding project test dependencies.
- Git ignore checks confirmed local environment files, dependencies, and generated files are excluded while `.env.example` is trackable. The specification and all other task entries are unchanged.

Environment notes: the shell defaults to Node 20, so verification used a temporary Node 24 runtime without changing the global installation. Use the README's Node 24 setup before local development. Sandbox port restrictions required running Next.js build/dev checks outside the sandbox. ESLint 9 is deprecated upstream but currently required by the selected lint plugins' peer ranges; revisit when their ESLint 10 support is available. Test-suite setup remains TASK-002.

### TASK-002 — Set up deterministic test tooling

Status: DONE
Milestone: M0  
Dependencies: TASK-001

#### Description

Establish fast unit and component testing before adding chess behavior.

#### Scope

- Configure Vitest and React Testing Library with appropriate server and DOM test environments.
- Add npm test as a non-watch command and a separate watch script.
- Test the existing home-page navigation or rendering behavior and document the test layout.

#### Out of scope

Playwright, real engine tests, paid API requests, and product logic.

#### Acceptance criteria

- Unit and component tests can run locally without PostgreSQL, Stockfish, or an OpenAI key.
- The initial test checks observable application behavior and fails when that behavior is broken.

#### Verification

- Standard checks.
- npm run test:watch — confirm watch mode starts.

#### Notes

Completed Vitest setup with separate Node.js and jsdom projects, React Testing Library, jest-dom matchers, explicit DOM cleanup, and the application's `@/` alias. Added three behavioral tests covering the home heading/availability message and server-rendered home/skip links. README documents test layout, filtering, environment limits, and commands.

Verification passed using Node 24.21.0:

- `npm run lint`, `npm run typecheck`, and `npm test` passed (2 files, 3 tests).
- Temporarily replacing the home heading with a paragraph caused the component test to fail for the missing accessible heading; the source was restored and the full suite passed afterward.
- `npm run test:watch` ran the suite, remained waiting for changes, and exited cleanly with `q`. Explicit `--watch` prevents CI environment detection from turning this command into a one-shot run.
- Tests run without starting the application or any database/engine/API service. No Playwright or integration setup was added.

The installed jsdom release requires Node 24.15.0 or later within the project's Node 24 range; package.json, lockfile, and README now reflect that minimum. No application behavior changed. TASK-003 remains TODO.

### TASK-003 — Configure PostgreSQL and Prisma

Status: DONE
Milestone: M0  
Dependencies: TASK-001

#### Description

Make local database setup reproducible without introducing product models yet.

#### Scope

- Add Docker Compose PostgreSQL service, a persistent volume, and a health check.
- Configure Prisma and a server-only database client.
- Document environment loading for Next.js, Prisma CLI, and tests, plus startup and connection verification.

#### Out of scope

Game schema, authentication, deployment, and cloud databases.

#### Acceptance criteria

- PostgreSQL starts and a server-side SELECT 1 succeeds using the configured connection.
- Database configuration is validated with useful errors and does not enter client bundles.
- Stopping and restarting the service retains its volume.

#### Verification

- docker compose up -d
- docker compose ps
- npx prisma validate
- Run the documented database connection check.
- Standard checks.

#### Notes

Completed PostgreSQL 18 Compose setup, named volume, health check, loopback port 5433, stable Prisma 7.10.0 configuration/generation, a lazy server-only Prisma client, sanitized URL validation, and `npm run db:check`. README documents development credentials, environment loading, startup, generation, persistence, and troubleshooting. The ignored `.env.local` was created with the documented local database URL; the names-only `.env.example` remains unchanged.

Verification passed with Node 24.21.0:

- `docker-compose up -d --wait` and `docker-compose ps`: healthy PostgreSQL. This machine uses standalone Compose; the equivalent `docker compose` commands are documented.
- `npx prisma validate`, `npm run db:generate`, and `npm run db:check`: valid empty schema, generated client, successful `SELECT 1` through Prisma.
- Removed/recreated only the project's container using `down` without `-v` and `up -d --wait`; PostgreSQL's cluster identifier remained unchanged and the connection check passed again. The public schema still contains zero tables.
- `npm run lint`, `npm run typecheck`, `npm test` (3 files, 13 tests), and `npm run build` passed.
- Prisma validation/generation also passed with blank DATABASE_URL. Missing/invalid URLs in the check script failed with safe messages, without exposing credentials.
- Local environment files and generated Prisma output are ignored; the browser JavaScript bundles contain neither the database URL nor DATABASE_URL configuration. The database client imports `server-only` to enforce its boundary in future routes.

No dummy models or migrations were added; TASK-007 owns the first product migration. Known limitation: npm audit reports four high-severity entries in Prisma's dependency tree, including with dev dependencies omitted; its proposed automatic fix is a Prisma 6 downgrade. The README records this unresolved dependency risk. PostgreSQL remains running locally for development.

### TASK-004 — Parse PGN into normalized game data

Status: DONE
Milestone: M1  
Dependencies: TASK-002

#### Description

Implement a server-safe chess.js parsing service and library-independent domain types.

#### Scope

- Preserve raw PGN and extract optional metadata with safe nullable dates.
- Produce ordered 1-based plies, full move numbers, color, SAN, UCI, fenBefore, and fenAfter.
- Return typed errors for malformed, illegal, empty, or unsupported input; document comments and variation handling.

#### Out of scope

Persistence, UI, engine analysis, and username inference.

#### Acceptance criteria

- Fixtures cover a normal game, missing headers, castling, promotion, en passant, check/checkmate, draw, and unfinished games.
- Comments and variations are tested according to the supported parser behavior; unsupported cases fail clearly.
- A supported SetUp/FEN game starts from its recorded position, including Black-to-move positions; full move numbers are not inferred solely from ply.
- Multiple-game input is rejected clearly rather than silently importing only one game.

#### Verification

- Standard checks, including the PGN fixture suite.

#### Notes

Implemented the pure `parsePgn` service with chess.js 1.4.0, independent DTOs in `types/game.ts`, typed safe errors, original-PGN preservation, nullable metadata/UTC dates, explicit initial FEN, and normalized main-line moves. Boundary checks reject multiple games without confusing result text in comments, headers, or variations. Standard SAN is validated by chess.js; recursive variations are retained in raw PGN but only main-line legality is checked.

Verification passed with Node 24.21.0:

- `npm test -- tests/unit/pgn.test.ts`: 36 parser tests passed using PGN fixtures for complete/missing-header games, castling, promotion/check, en passant, checkmate, draw, unfinished games, comments/NAGs/nested variations, custom Black-to-move starts, illegal moves, and multiple games.
- Assertions verify known FENs, UCI promotion suffix, position continuity, full-move numbering independent of ply, leap/invalid/partial dates, raw input preservation, and stable error codes.
- `npm run lint`, `npm run typecheck`, and `npm test`: all passed (4 files, 49 tests).

README documents supported syntax and limits, including strict SAN and unsupported escaped quotes in header values. Recorded results and supplied termination reasons remain separate from board-derived checkmate/draw flags; resignation is not inferred. No UI, persistence, engine, or AI work was added. Existing Prisma audit advisories are unchanged.

### TASK-005 — Build the three-control import form

Status: DONE
Milestone: M1  
Dependencies: TASK-004

#### Description

Allow a user to choose their side and submit a PGN for authoritative server parsing.

#### Scope

- Build /games/new with a required White/Black selector, PGN textarea, and submit button.
- Validate input with Zod on the server; provide basic client feedback, pending state, and safe errors.
- Return normalized parsed data through a temporary server action for the replay slice.

#### Out of scope

Database persistence, analysis execution, and additional import settings.

#### Acceptance criteria

- Missing/invalid color and malformed PGN are rejected server-side, including requests that bypass the browser.
- Both colors can be selected, values survive validation errors, and repeated submission is disabled while pending.
- A valid PGN returns normalized data and selected user color without trusting client-generated positions.

#### Verification

- Standard checks with form and request-validation tests.
- Submit valid and invalid examples manually for both colors.

#### Notes

Implemented `/games/new` with the required color selector, PGN textarea, and Import button, plus a home-page entry link. The temporary server action validates both fields with Zod, parses positions server-side, and returns the parsed game with userColor. It ignores client-derived positions and returns safe field/general errors. The form keeps inputs after errors, disables controls while pending, catches transport failures, and shows a clearly unsaved parsed preview. A 100,000-character PGN limit provides a bounded single-game request.

Verification passed with Node 24.21.0:

- Server-action tests cover both colors, missing/invalid values, whitespace, oversize PGN, illegal moves, uploaded files in text fields, forged positions, and sanitized unexpected failures.
- Component tests cover the three controls, whitespace feedback, both colors, pending state, retained input, stale preview removal, and transport failures. They caught React action resets changing the selected color; the form now prevents automatic resets.
- `npm run lint`, `npm run typecheck`, and `npm test` passed (6 files, 67 tests). `npm run build` passed.
- Browser checks against the production build submitted invalid then valid PGNs for White and Black, confirmed input retention and correct parsed results, followed the home link, checked 390px layout, and verified preview removal on refresh with no page errors.

No persistence, analysis, or board UI was added. TASK-008 must replace the temporary action with persisted import. The button remains Import until TASK-019 connects analysis. README documents the current temporary behavior.

### TASK-006 — Replay an imported game on an interactive board

Status: DONE
Milestone: M1  
Dependencies: TASK-005

#### Description

Complete the first usable slice: paste a PGN and replay its main line.

#### Scope

- Render react-chessboard, move list, metadata, and Start/Previous/Next/End controls.
- Keep selected ply in one state owner and orient the board using the selected color.
- Define and document move-selection semantics for later engine and annotation panels.

#### Out of scope

Persistence, engine evaluation, AI panels, and free analysis by moving pieces.

#### Acceptance criteria

- A complete fixture replays correctly from its actual initial position to the final ply.
- Clicking a move selects its resulting position (fenAfter); ply 0 shows the initial position.
- The selected move is obvious, navigation respects boundaries, and move numbering works for Black-to-move starts.
- The board fits its container at desktop and narrow widths; tests verify positions and both orientations.

#### Verification

- Standard checks with navigation component tests.
- Import and replay a complete game from start to finish for White and Black.

#### Notes

Implemented the in-memory replay slice with react-chessboard 5.12.1, a read-only board oriented to userColor, metadata, a move table, and Start/Previous/Next/End controls. `GameReview` owns selectedPly; ply 0 uses initialFen and every selected move displays fenAfter. Black-to-move starts retain actual full-move numbering and use the Black column. Selection is highlighted and navigation is bounded.

Browser testing uncovered multipart submission normalizing multiline PGN to CRLF while the textarea retains LF. The import form now normalizes line endings only when comparing current input to the server response, preserving the submitted raw PGN. A regression test covers this case.

Verification passed with Node 24.21.0:

- `npm run lint`, `npm run typecheck`, and `npm test` passed (7 files, 73 tests); `npm run build` passed.
- Real-board component tests verify every square/piece position through a complete fixture forwards and backwards for both orientations, direct selection, Start/End, castling, metadata, and custom Black-to-move numbering.
- Production-browser checks import a multiline fixture for White and Black, replay all moves, verify actual piece placements/orientation, and jump directly to castling. A SetUp/FEN fixture verifies a Black start at move 23.
- Browser layout checks at 1280px, 768px, and 390px confirm a square board within its container and no horizontal overflow; mobile rendering was visually inspected. No page errors occurred.

README documents the replay convention: later panels must label before/after evaluations and explain that alternatives start from fenBefore. Persistence, engine analysis, AI panels, free piece movement, manual flip, and keyboard navigation remain outside this task. The preview is still lost on refresh. Existing Prisma audit advisories are unchanged.

### TASK-007 — Add Game and GameMove persistence models

Status: DONE
Milestone: M2  
Dependencies: TASK-003, TASK-004

#### Description

Introduce the initial database schema for saved games and normalized moves.

#### Scope

- Add Game and GameMove models, required userColor, analysis status/error fields, and metadata from the spec.
- Enforce a unique (gameId, ply) constraint and appropriate relations/indexes.
- Create the migration and isolated test-database setup with documented cleanup.

#### Out of scope

Engine/AI result fields, Puzzle models, User models, and authentication.

#### Acceptance criteria

- The migration applies to a fresh development database and a separate test database.
- Invalid colors, duplicate plies within a game, and orphan moves are rejected.
- A stored fixture preserves raw PGN, metadata, positions, move order, and user color.

#### Verification

- npx prisma validate
- npx prisma migrate dev
- npm run test:integration — introduce this script for isolated database tests.
- Standard checks.

#### Notes

Added Game/GameMove models and the initial migration, required ChessColor enums, analysis status/error fields, timestamps, nullable PGN metadata, explicit initial FEN, and the supplied termination header. The unique (gameId, ply) constraint enforces per-game move identity; the foreign key rejects orphans and cascades deletion, and the game ordering index supports the future library. Engine/AI fields remain deferred.

Integration tooling uses a separate PostgreSQL service, user, and database on localhost:5434 with disposable tmpfs storage. `npm run test:integration` guards the URL, verifies the connected database identity, applies migrations with a separate Prisma config, and runs only integration tests. Cleanup rechecks identity and deletes only test-owned IDs. Local development environment files are never loaded by the test runner.

Verification passed with Node 24.21.0:

- `npx prisma format`, `npx prisma validate`, and `npm run db:generate` passed.
- `npx prisma migrate dev --name initial_games` applied the migration to the development database; the integration runner applied it independently to the fresh test database.
- `npm run test:integration`: 7 tests passed, covering both user colors, fixture metadata/PGN/FEN/move-order round trips, duplicate ply rejection, orphan rejection, invalid/missing user colors, invalid move colors, status/error updates, and cascading deletion.
- `npm run lint`, `npm run typecheck`, and `npm test`: passed (8 files, 82 tests). Safety unit tests reject changed hosts/ports/schema parameters and incorrect database identities.
- The actual integration runner refused an inherited development DATABASE_URL before migration/tests. Post-suite SQL checks found zero Game and GameMove fixture rows in the test database.

README includes setup, environment isolation, migrations, and cleanup commands that target only the test service. Both database services remain running. Import UI persistence belongs to TASK-008; no product behavior was expanded. Existing dependency audit limitations remain unchanged.

### TASK-008 — Persist validated imports transactionally

Status: DONE
Milestone: M2  
Dependencies: TASK-005, TASK-007

#### Description

Replace temporary import handling with the permanent game creation contract.

#### Scope

- Implement POST /api/games and a testable import application service.
- Validate color and PGN, then save game and moves in one transaction with PENDING status.
- Connect the import form to persistence; return gameId and status with a stable error envelope.

#### Out of scope

Automatic analysis, duplicate-PGN detection, game editing, and deletion.

#### Acceptance criteria

- Valid imports persist all normalized moves and selected color.
- Invalid requests return 400 and create no rows; database failure cannot leave a partial import.
- Unexpected errors are sanitized and the form offers a useful retry.
- The temporary parse-only import action is removed; TASK-009 completes the saved review navigation.

#### Verification

- Standard checks.
- npm run test:integration — valid import, invalid color/PGN, and transaction rollback cases.

#### Notes

Identical PGNs may be imported as separate games in V0.1. Do not introduce deduplication requirements.

Completed POST `/api/games`, a testable import service, and an atomic Prisma nested-write repository. The form now saves imports with selected color, normalized moves, and PENDING status before showing replay. Removed the temporary server action. Validation precedes database access; errors use stable codes and safe messages. Failed requests retain input and allow retry. The response includes gameId/status and parsed replay data; saved review navigation remains TASK-009.

Verification: 91 unit/component tests and 11 isolated PostgreSQL integration tests passed, including actual constraint-triggered rollback and retry. Lint, typecheck, and production build passed. README documents the API contract and current saved-game navigation limitation. Existing dependency audit limitations are unchanged.

### TASK-009 — Add the saved game library and review URLs

Status: DONE
Milestone: M2  
Dependencies: TASK-006, TASK-008

#### Description

Make saved games discoverable and reviewable after refresh or restart.

#### Scope

- Implement summarized game listing and detailed game retrieval using stable DTOs.
- Build /games and /games/[id], reuse the replay components, and redirect successful imports to review.
- Add loading, empty, missing-game, and database-error states.

#### Out of scope

Engine execution, coaching, advanced filtering, and statistics.

#### Acceptance criteria

- Games appear newest first with available players, result, date, opening, and status.
- A saved review restores all moves and default orientation from userColor.
- Refresh and application/database restart preserve the game; unknown IDs show a useful not-found state.
- List responses do not unnecessarily return raw PGN or every move.

#### Verification

- Standard checks.
- npm run test:integration — list/detail DTOs and missing game.
- Import, reopen from the library, refresh, and restart the local stack.

#### Notes

M2 exit: a persistent game library with complete move replay, even before analysis exists.

Implemented `/games`, `/games/[id]`, summarized GET `/api/games`, and detailed GET `/api/games/[id]`. Database queries map to application DTOs with ISO dates; summaries exclude raw PGN and moves, while detail returns moves ordered by ply. Imports navigate to permanent reviews, and stored userColor restores orientation. Added loading, empty, missing-game, and safe retryable database-error states, plus home/library navigation.

Verification: 99 unit/component tests, 15 isolated PostgreSQL integration tests, lint, typecheck, and production build passed. Chromium verified import-to-review navigation, replay, reopening from the library, refresh, and missing-game UI. Restarted the verification app and local PostgreSQL service (preserving its named volume), then successfully reopened the same saved Black-side game. Removed only the marked browser fixture after verification. Existing dependency audit limitations are unchanged.

### TASK-010 — Implement the server-side Stockfish UCI adapter

Status: DONE
Milestone: M3  
Dependencies: TASK-002

#### Description

Wrap a local Stockfish process behind a typed, testable engine interface.

#### Scope

- Implement initialization, readiness, FEN setup, bounded search, info parsing, and shutdown.
- Validate STOCKFISH_PATH and depth/time limits; keep process management outside routes.
- Handle fragmented output, engine exit, missing executable, and timeouts with cleanup.

#### Out of scope

Database persistence, classification, coaching, and browser-based engines.

#### Acceptance criteria

- Deterministic protocol fixtures cover cp/mate scores, bestmove, PV, malformed output, and terminal positions.
- Completed, failed, and timed-out searches release processes and resources.
- A separate opt-in smoke script analyzes a legal position with installed Stockfish.

#### Verification

- Standard checks with mocked process/protocol tests.
- npm run test:engine — introduce and document an opt-in real-engine smoke script.

#### Notes

Document engine installation for the current macOS development environment. Preserve score perspective, depth, and bound information needed by downstream logic.

Implemented the typed server-side engine interface, validated configuration, UCI parser, isolated process lifecycle, bounded depth/time search, legal bestmove/PV checks, terminal handling, and sanitized errors. Scores retain side-to-move perspective, cp/mate kind, depth, and bounds. Cleanup includes graceful quit, forced termination, and bounded stream/listener/timer teardown. Added the opt-in `npm run test:engine` script and macOS setup documentation. No routes, persistence, or classification were added.

Verification: 128 unit/component tests passed, including fragmented output, malformed/illegal protocol data, cp/mate bounds, terminal positions, process/stream failures, timeouts, and shutdown escalation. Lint, typecheck, production build, and the real-engine smoke test passed. The official Stockfish 19 macOS universal binary was downloaded into `/tmp/chess-stockfish-19` for verification; global installations and local environment configuration were unchanged. Configure a durable STOCKFISH_PATH before using the engine in regular development. Existing dependency audit limitations are unchanged.

### TASK-011 — Normalize evaluations and classify move quality

Status: DONE
Milestone: M3  
Dependencies: TASK-004, TASK-010

#### Description

Convert engine output into consistent chess facts and moving-player quality assessments.

#### Scope

- Store evaluations from White’s perspective and compute loss from the moving player’s perspective.
- Keep mate distance separate from centipawns and define mate gained/lost comparison rules.
- Implement documented thresholds and safeguards for forced moves, equivalent moves, and overwhelming positions.

#### Out of scope

AI judgments, brilliant labels, puzzle suitability, and engine orchestration.

#### Acceptance criteria

- Tests cover White and Black, side-to-move sign flips, and threshold boundaries at 20, 50, and 100 cp.
- Tests cover mate found, missed, allowed, retained, and terminal positions without coercing mate into ordinary cp.
- Negative apparent loss from finite search is handled explicitly; bound-only or missing results are not presented as exact facts.
- Safeguards rely on available evidence and document limitations of shallow analysis.

#### Verification

- Standard checks with evaluation and classification fixtures.

#### Notes

Persist enough normalized raw facts to recalculate classification without rerunning Stockfish. Do not claim a move is difficult merely because it matches the best move.

Implemented pure White-perspective normalization and versioned mover-relative classification DTOs. Sign conversion reverses bounds; mate scores retain winner identity, including mate zero. Assessments retain positions, move, legal-move count, best move, normalized score/depth/PV facts, terminal outcome, and raw/clamped cp loss for later storage and recalculation. Added exact 20/50/100 cp thresholds, explicit mate transitions, and forced/equivalent/overwhelming-position safeguards. Missing, bounded, and shallow results remain unknown; contradictory search results are flagged. Database persistence and orchestration remain TASK-012.

Verification: 143 unit/component tests, lint, typecheck, production build, and diff checks passed. Fixtures cover both colors, all loss boundaries, bound reversal, negative apparent loss, mate found/missed/allowed/retained/escaped, mate-zero serialization, terminal checkmate/draw, and confidence safeguards. README documents policy version 1 and shallow-search/repetition-history limitations. Existing dependency audit limitations are unchanged.

### TASK-012 — Store and orchestrate engine analysis

Status: DONE
Milestone: M3  
Dependencies: TASK-007, TASK-010, TASK-011

#### Description

Analyze a saved game through an application service and persist reusable engine results.

#### Scope

- Add engine fields and migration for before/after cp or mate values, best move, PV, loss, and classification.
- Analyze required positions with conservative bounded settings; derive SAN from legal UCI moves.
- Transition PENDING to ENGINE_RUNNING to ENGINE_COMPLETED, save results, and persist sanitized failures.

#### Out of scope

HTTP run control, AI calls, and distributed job systems.

#### Acceptance criteria

- A deterministic mock engine populates the correct game/ply records and White-perspective values.
- PV moves are checked for legality from the corresponding FEN and terminal positions are handled.
- Failure preserves the imported game and any committed engine results.
- Results retain configuration/depth metadata needed to explain analysis limitations.

#### Verification

- Standard checks.
- npm run test:integration — successful and failed engine orchestration.

#### Notes

Avoid holding a database transaction open while Stockfish searches. Reuse adjacent position results where valid rather than analyzing the same FEN needlessly.

Implemented the injectable analysis service, server-only Stockfish/database wiring, and additive MoveEngineAnalysis model/migration. Each move stores White-perspective cp/mate fields, best move and PV in UCI/SAN, loss/classification, versioned raw assessment facts, configuration, run ID, and timestamp. Searches run sequentially without open database transactions and reuse adjacent results. Terminal boards bypass engine search. Per-move upserts preserve partial progress; safe failures retain imported data, and completion is recorded only after every move is saved. HTTP controls and interrupted-run recovery remain TASK-013.

Verification: 145 unit/component tests and 23 isolated PostgreSQL integration tests passed, along with lint, typecheck, production build, and diff checks. Integration cases include deterministic success, correct ply/perspective mapping, N+1 search reuse, legal SAN/PV conversion, terminal checkmate/stalemate, engine and storage failure preservation, invalid configuration, and retry upserts. The additive migration was applied to test and local development databases. Existing dependency audit limitations are unchanged.

### TASK-013 — Expose retryable analysis execution

Status: DONE
Milestone: M3  
Dependencies: TASK-009, TASK-012

#### Description

Allow the local app to start or retry analysis without duplicate simultaneous work.

#### Scope

- Implement POST /api/games/{id}/analyze and a review-page analysis/retry action.
- Guard concurrent runs for the same game and expose persisted stage/status.
- Define interrupted-run recovery and idempotent engine writes; document the local execution lifecycle.

#### Out of scope

AI stage, Redis, external queues, and production workers.

#### Acceptance criteria

- Two simultaneous requests cannot launch duplicate analysis for one game.
- A failed run can be retried without duplicate move records or losing the imported game.
- Restart during ENGINE_RUNNING leaves a recoverable game rather than a permanently locked status.
- Missing games, engine failures, and busy runs return stable safe responses.

#### Verification

- Standard checks.
- npm run test:integration — concurrency, retry, and stale-run recovery.
- Interrupt a local run, restart, and retry it.

#### Notes

Start with a synchronous Node.js route if reliable for measured game duration. If it is not, use a documented local mechanism with explicit lifecycle management; no untracked fire-and-forget request work.

Implemented the synchronous Node.js analyze endpoint, review-page analyze/retry/status-refresh controls, and safe HTTP outcomes. Added a five-minute database lease and unique ownership token with conditional acquisition, per-move renewal, and fenced writes/completion. Expired or legacy unleased running rows can recover; old owners cannot overwrite a replacement. Detail DTOs expose persisted error and lease deadline. Retry upserts retain imported games and prevent duplicate assessments.

Verification: 154 unit/component tests and 26 PostgreSQL integration tests passed, plus lint, typecheck, production build, and diff checks. Integration tests cover concurrency, retries, stale-owner fencing, and legacy recovery. Applied the additive migration locally and to the test database. A real Stockfish run was interrupted by killing only the temporary verification server; after restart it correctly returned 409 before expiry. Expired only the marked fixture lease to simulate the recovery deadline, then browser retry completed four plies at depth 12 in about 1.4 seconds; status survived refresh. Removed the marked fixture afterward. README documents the five-minute recovery window, synchronous local lifecycle, and limits of the measured workload. Existing dependency audit limitations are unchanged.

### TASK-014 — Display engine analysis in game review

Status: DONE
Milestone: M3  
Dependencies: TASK-013

#### Description

Make objective analysis useful before adding the AI coach.

#### Scope

- Show current evaluation, mate indicators, move classification, best move, and short PV.
- Add clickable critical-move markers using the existing selected-ply state.
- Show engine pending, complete, partial, and failed states with appropriate actions.

#### Out of scope

AI summaries, training, and full alternate-line board exploration.

#### Acceptance criteria

- Selecting a move or marker synchronizes the board and that move’s engine panel.
- Current-position evaluation refers to fenAfter; before/after comparisons are labeled and alternatives refer to fenBefore.
- Mate and missing evaluations never display as misleading centipawn values.
- A full game can be reviewed with no OpenAI key.

#### Verification

- Standard checks with selected-ply and engine-panel component tests.
- Analyze a fixture with real Stockfish and review both colors, including a mating position.

#### Notes

M3 exit: persistent review with objective engine data and actionable retries.

Implemented the persisted analysis DTO mapper and selected-ply engine panel with explicitly labeled initial/after/before evaluations, mate/checkmate and bounds, classification/loss, engine choice, and short SAN PV from the before position. Critical-move buttons share the existing board/move-list selection. Added saved/partial coverage and mixed-run notices while retaining pending/failed/retry controls. Unsupported stored assessment versions are shown as unavailable. No AI dependency or alternate-line board exploration was added.

Verification: 159 unit/component tests and 27 PostgreSQL integration tests passed, plus lint, typecheck, production build, and diff checks. Chromium analyzed real Stockfish checkmate fixtures for both selected colors and verified markers, engine-panel selection, checkmate display, reload, and narrow mobile layout. Removed both marked browser fixtures and stopped the temporary server. Existing dependency audit limitations are unchanged.

### TASK-015 — Select instructional moments

Status: DONE
Milestone: M3  
Dependencies: TASK-011, TASK-012

#### Description

Choose a small, diverse set of engine-grounded moments for coaching.

#### Scope

- Prioritize the selected user’s meaningful losses and major changes while allowing useful opponent context.
- Avoid near-duplicate moments from the same sequence and cap selection around 5–10.
- Include evidence-backed positive candidates when supported; return structured selection reasons.

#### Out of scope

Calling the model, annotating every move, and unsupported tactical/difficulty claims.

#### Acceptance criteria

- Deterministic tests cover both user colors, ranking, ties, adjacent tactical sequences, and short or quiet games.
- No unknown or duplicate plies are selected; sparse games are not padded with invented mistakes.
- Positive candidates are tied to supplied facts and are not labeled brilliant from loss alone.

#### Verification

- Standard checks with moment-selection fixtures.

#### Notes

Allow fewer than five moments when evidence is limited. Categories and educational wording remain the coaching stage’s responsibility.

Implemented the pure deterministic selector with a default cap of eight (maximum ten), user-color loss priority, explicit mate/advantage-change evidence, reserved positive/opponent context, and a two-ply proximity exclusion. Returned moments contain known plies and structured evidence; duplicate/mismatched, unknown, shallow, bounded, forced, overwhelming, or contradictory assessments are excluded. Mate-found/escaped/checkmate positives require supplied facts; low loss or best-move agreement alone is not highlighted. Quiet/sparse games are not padded. No model calls or UI changes were added.

Verification: 173 unit/component tests, lint, typecheck, production build, and diff checks passed. Selection fixtures cover both colors, ranking and deterministic ties, shuffled input, adjacent sequences, caps/diversity, invalid or duplicated plies, quiet/short games, positive evidence, and confidence exclusions. README documents policy and proximity-heuristic limits. Existing dependency audit limitations are unchanged.

### TASK-016 — Define the versioned coaching contract

Status: TODO  
Milestone: M4  
Dependencies: TASK-015

#### Description

Create runtime schemas and cross-checks before connecting the OpenAI adapter.

#### Scope

- Define schemaVersion, summary, strengths, improvements, and criticalMoments with bounded strings/arrays.
- Centralize allowed categories and classification values.
- Validate against the game and supplied selected plies; protect engine facts from model changes.

#### Out of scope

Network requests, prompt construction, and database writes.

#### Acceptance criteria

- Tests reject unknown/duplicate plies, unselected references, unsupported schema versions, invalid categories, and excessive content.
- Valid responses map to an application-owned DTO.
- Model classifications cannot overwrite engine classifications; mismatches are rejected or normalized under an explicitly documented rule.

#### Verification

- Standard checks with valid and adversarial response fixtures.

#### Notes

The spec’s conceptual example uses development; the controlled category is opening.development. Use the canonical category in actual schemas and fixtures.

### TASK-017 — Build grounded coaching prompts

Status: TODO  
Milestone: M4  
Dependencies: TASK-016

#### Description

Package selected engine facts into one game-level coaching request.

#### Scope

- Include userColor, approximate 1400 Lichess rapid level, metadata/context, selected FENs, moves, scores, and legal PVs.
- Specify concise transferable lessons, authoritative engine data, schema requirements, and allowed categories.
- Treat PGN headers/comments as game data rather than model instructions.

#### Out of scope

Network calls, model-generated engine evaluations, and additional import fields.

#### Acceptance criteria

- Tests verify both user colors, correct selected plies/FENs, score perspective, and mate representation.
- Missing optional metadata or few selected moments produce a valid bounded payload.
- Only supplied engine-supported continuations are offered as objective better moves.

#### Verification

- Standard checks with prompt payload fixtures.
- Inspect one generated request for clarity and size without including secrets.

#### Notes

Keep rating as the documented V0.1 default; do not add a rating control to the three-control form.

### TASK-018 — Implement the server-only OpenAI adapter

Status: TODO  
Milestone: M4  
Dependencies: TASK-017

#### Description

Obtain structured coaching through the supported SDK mechanism and application validation.

#### Scope

- Configure server-only API key/model access and structured output.
- Map missing key, refusal, incomplete output, timeout, rate limit, API error, and invalid response into safe typed failures.
- Use an injectable client for deterministic tests and record model/schema metadata.

#### Out of scope

Persistence, browser API calls, automatic paid smoke tests, and general chat.

#### Acceptance criteria

- One game-level request is issued per attempt and its output passes both schema and semantic cross-checks.
- Mocked tests cover valid output and all major failure classes.
- API keys and sensitive headers never appear in browser payloads, bundles, or logs.

#### Verification

- Standard checks with mocked SDK responses.
- npm run build — verify server/client import boundaries.

#### Notes

Choose a supported model and verify current official SDK documentation at implementation time. Fast tests must never require paid API access.

### TASK-019 — Persist coaching and complete the analysis flow

Status: TODO  
Milestone: M4  
Dependencies: TASK-013, TASK-015, TASK-018

#### Description

Extend engine analysis with retryable coaching and durable validated annotations.

#### Scope

- Add MoveAnnotation and Game summary/strengths/improvements fields with a migration.
- Run AI_RUNNING after saved engine results; validate before transactionally saving annotations and marking COMPLETED.
- Connect Import and Analyze to import then analysis, with visible stage feedback and navigation to the saved review.
- Retry failed coaching using existing engine facts and upsert annotations without duplication.

#### Out of scope

Puzzles, forced engine reruns on AI failure, and multiple annotation histories.

#### Acceptance criteria

- Mocked end-to-end orchestration saves a completed summary and correctly linked annotations.
- Invalid output or API failure leaves engine analysis reviewable and no partially saved coaching payload.
- Retry after AI failure does not rerun Stockfish or duplicate annotations; concurrency protection covers the AI stage.
- Missing key and interrupted AI runs are actionable and recoverable; imported games remain accessible.

#### Verification

- Standard checks.
- npm run test:integration — successful coaching, invalid output, AI-only retry, and concurrency.
- Import with a missing key and confirm the saved engine review can still be opened.

#### Notes

Keep persisted stage completion distinguishable from generic FAILED status so retries can select the correct stage.

### TASK-020 — Display coaching summaries and move explanations

Status: TODO  
Milestone: M4  
Dependencies: TASK-014, TASK-019

#### Description

Complete the coached review with concise explanations beside the correct move.

#### Scope

- Render summary, strengths, improvements, headline, explanation, lesson, and category.
- Show annotation only for the selected move and link summary moments to canonical plies.
- Provide useful engine-only and coaching-failed panels with retry access.

#### Out of scope

Freeform chat, weakness history, and training.

#### Acceptance criteria

- Clicking a summary moment selects its move, resulting position, engine facts, and annotation together.
- Ordinary moves do not inherit a stale explanation from the previously selected critical move.
- Before-position alternatives are clearly distinguished from the displayed after-position.
- Long validated text remains readable without breaking the layout.

#### Verification

- Standard checks with summary/annotation synchronization tests.
- Review a complete mocked coached game and an engine-only game.

#### Notes

M4 exit: persisted explanations grounded in engine data, with useful AI-independent review.

### TASK-021 — Polish responsive review and keyboard navigation

Status: TODO  
Milestone: M5  
Dependencies: TASK-020

#### Description

Make reviewing a complete game comfortable across desktop, tablet, and narrow screens.

#### Scope

- Refine board/panel layout, selected-move visibility, move-list scrolling, and metadata presentation.
- Add manual board flip and left/right navigation without intercepting text input.
- Provide accessible control labels, focus states, and understandable evaluation/color indicators.

#### Out of scope

Pixel-perfect analytics, alternative-line explorers, and new product screens.

#### Acceptance criteria

- Board and panels do not overflow representative desktop, tablet, and mobile widths.
- Flip changes orientation without changing selected ply, saved userColor, or coaching perspective.
- Keyboard and button navigation remain equivalent; text fields and editable content retain normal keyboard behavior.
- Selected moves remain visible in long move lists.

#### Verification

- Standard checks with keyboard/flip component tests.
- Manually inspect desktop, tablet, and narrow mobile layouts and keyboard-only navigation.

#### Notes

Keep explanations visually primary; avoid flooding the panel with engine lines.

### TASK-022 — Present positive instructional highlights

Status: TODO  
Milestone: M5  
Dependencies: TASK-015, TASK-020

#### Description

Ensure the review teaches from strong play as well as mistakes.

#### Scope

- Expose supported positive selections and their coaching in the summary and move list.
- Keep instructional highlights separate from objective loss classifications.
- Handle games with no supported positive highlight without fabricated praise.

#### Out of scope

Brilliant-move scoring, new engine-strength claims, and exhaustive annotation.

#### Acceptance criteria

- An explicit engine/coaching fixture displays a positive highlight at the correct ply.
- Positive labels do not overwrite engine classifications or create unsupported evaluations.
- Games without positive candidates remain coherent and do not fabricate highlights.

#### Verification

- Standard checks with positive and no-positive fixture cases.

#### Notes

Reuse the selection and coaching contracts; do not introduce a second analysis pipeline.

### TASK-023 — Complete progress and recovery UX

Status: TODO  
Milestone: M5  
Dependencies: TASK-021, TASK-022

#### Description

Make every long-running, partial, empty, and failed state understandable and recoverable.

#### Scope

- Audit importing, engine analysis, coaching, saving, completed, and failed displays across routes.
- Connect persisted status updates to the chosen execution mechanism and handle refresh during analysis.
- Provide clear next actions for invalid input, database outage, missing engine/key, and stage failures.

#### Out of scope

Production observability systems and distributed background infrastructure.

#### Acceptance criteria

- A refresh can locate the saved game and its persisted stage; duplicate analysis cannot be started from stale UI.
- Failure messages are sanitized and preserve access to completed work.
- Loading/error/empty/success states are exercised with deterministic fixtures.
- Any progress display reflects real stage data rather than invented percentages.

#### Verification

- Standard checks.
- npm run test:integration — recovery regressions affected by this task.
- Manually interrupt analysis and exercise missing-engine, missing-key, and unavailable-database states.

#### Notes

M5 exit: coherent full-game review with positive lessons, navigation, and recovery.

### TASK-024 — Build the minimal home dashboard

Status: TODO  
Milestone: M6  
Dependencies: TASK-009

#### Description

Provide a useful entry point for the local review workflow.

#### Scope

- Show saved-game count, recent games, Import Game, and My Games links.
- Reuse summarized game queries and add empty/loading/error states.

#### Out of scope

Weakness counts, puzzle/training metrics, authentication, and analytics dashboards.

#### Acceptance criteria

- Counts and recent-game links reflect saved data and lead to the correct reviews.
- An empty database clearly directs the user to import a game.
- Database errors show a useful action without exposing internals.

#### Verification

- Standard checks with dashboard states.
- npm run test:integration — dashboard query coverage where not already covered.
- Open home with empty and populated databases.

#### Notes

This is intentionally small; the primary V0.1 experience remains game review.

### TASK-025 — Verify the complete local review journey

Status: TODO  
Milestone: M6  
Dependencies: TASK-023, TASK-024

#### Description

Add a small reliable browser regression suite and confirm V0.1 acceptance behavior.

#### Scope

- Configure Playwright with an isolated database and deterministic engine/AI test adapters.
- Cover import, validation, persistence, navigation, critical moments, coaching failure, and retry.
- Keep real-engine smoke checks separate and document a manual real-service check.

#### Out of scope

Paid API calls in automated tests, broad browser matrices, and exhaustive visual snapshots.

#### Acceptance criteria

- Browser tests cover both selected colors, invalid input, refresh, and saved-library reopening.
- Board position and annotation match after direct move and critical-moment selection.
- AI failure retains engine results and successful retry adds coaching without duplicate records.
- Test adapter selection cannot silently replace real services in normal local use.

#### Verification

- Standard checks.
- npm run test:integration
- npm run test:e2e — introduce this script.
- npm run test:engine
- npm run build

#### Notes

Use real chess fixtures and explicit mocked facts. Record any live OpenAI verification separately, including whether it was skipped for lack of credentials.

### TASK-026 — Finish setup documentation and release acceptance

Status: TODO  
Milestone: M6  
Dependencies: TASK-025

#### Description

Make the review-only V0.1 reproducible from a clean local environment.

#### Scope

- Finish README prerequisites, environment setup, migrations, startup, Stockfish installation, and troubleshooting.
- Add a non-sensitive sample PGN and document the complete import-to-review walkthrough.
- Audit the definition of done, remove obsolete experiments, and record known limitations and measured analysis duration.

#### Out of scope

Deployment, authentication, puzzle features, weakness statistics, and new scope discovered during release review.

#### Acceptance criteria

- Documented steps work with a fresh local database without deleting the user’s development data.
- Every V0.1 definition-of-done item has verification evidence; blocked items are stated explicitly.
- Standard tests and build pass; real-engine checks succeed in the supported local environment.
- A live coaching check is recorded when credentials are available; if unavailable, mark the affected release verification blocked rather than claiming it passed.
- The repository contains no real secrets, dead temporary import paths, or required V0.2 features.

#### Verification

- Follow README setup against an isolated fresh database.
- Standard checks.
- npm run test:integration
- npm run test:e2e
- npm run test:engine
- npm run build
- Review the specification’s definition of done and record evidence in Notes.

#### Notes

M6 exit: the full local import → analyze → coach → review loop is documented and verified. Do not mark this task DONE while required acceptance evidence is missing.

