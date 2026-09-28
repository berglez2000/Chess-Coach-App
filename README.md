# Chess Coach App

A local chess-improvement application for importing PGNs, analyzing games with Stockfish, and reviewing them with AI coaching.

V0.1 supports a saved-game dashboard, PGN import, Stockfish analysis, validated AI coaching, and synchronized board review. It runs locally without authentication. Puzzles, training, weakness statistics, and deployment are deferred.

**Release acceptance is blocked:** live coaching credentials are unavailable and the default Turbopack build has an environment limitation. Both Anthropic and OpenAI are implemented; live provider checks remain unverified. Engine-only review works without a provider key. See [release evidence](docs/release-acceptance.md) for checks and limitations.

## Prerequisites

- Node.js **24 LTS, version 24.15.0 or later** (verified with 24.21.0), with npm 10 or later.
- If you use nvm, run `nvm install` and `nvm use` in this directory; `.nvmrc` selects Node 24.
- Confirm `node --version` prints `v24.x` before installing dependencies. The project declares Node 24 in `package.json` to keep development consistent.

Docker with Compose is required (Docker Desktop or a running Colima engine on macOS). Install a local Stockfish executable for analysis. Coaching uses an optional paid Anthropic or OpenAI API key; without it, engine results remain available. The verified environment is macOS arm64, Node 24.21.0, PostgreSQL 18, and Stockfish 19. Other operating systems have not received release verification. Fast tests require none of these external services.

## Local development

1. Activate Node 24 and start Docker.
2. If `.env.local` does not exist, copy `.env.example` to `.env.local`; preserve existing values.
3. Set `DATABASE_URL` as shown below and `STOCKFISH_PATH` to an absolute executable path from the [Stockfish setup](#local-stockfish-adapter).
4. Set `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` for live coaching, then select the provider in **Settings**. The default is Anthropic; missing keys do not trigger fallback. Models are configured in `lib/coaching/providers.ts`; there is no model environment override. Keep keys server-side, never use `NEXT_PUBLIC_`, and restart after changing keys.
5. Run:

```bash
npm ci
docker compose up -d --wait postgres
npx prisma validate
npx prisma migrate deploy
npm run db:check
npm run test:engine
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The server binds to loopback. Stop with Ctrl+C; use `npm run dev -- --port 3001` for another port. If Turbopack fails with a worker-port permission error, use `npm run dev -- --webpack`. The database is required for the dashboard and saved reviews.

## Local PostgreSQL and Prisma

1. Start Docker Desktop or your Colima engine.
2. If `.env.local` does not exist, copy `.env.example` to `.env.local`. Preserve any existing values.
3. Set `DATABASE_URL` to the local development connection string:

```dotenv
DATABASE_URL=postgresql://chess_coach:chess_coach_local@127.0.0.1:5433/chess_coach
```

These are disposable local-development credentials matching `compose.yaml`, not production credentials. PostgreSQL is published only on `127.0.0.1:5433`; the container uses port 5432. The named `postgres_data` volume stores the database under `/var/lib/postgresql`, as required by the PostgreSQL 18 image.

```bash
docker compose up -d --wait postgres
docker compose ps
npm ci
npx prisma validate
npx prisma migrate deploy
npm run db:check
npm run dev
```

On this macOS setup, Compose is installed as **`docker-compose`**. If `docker compose` is unavailable, substitute `docker-compose` in these commands, for example `docker-compose up -d --wait`. Both read `compose.yaml`; no global Docker configuration change is required.

`npm install` / `npm ci` generates the Prisma client through `postinstall`. After changing the Prisma schema, run `npm run db:generate`. Generated files are ignored by Git. The schema contains games, moves, engine assessments, and coaching annotations. Use `npx prisma migrate deploy` to apply checked-in migrations without a reset or shadow database; use `npx prisma migrate dev --name <description>` when intentionally changing the schema. Regenerate the client afterward with `npm run db:generate`.

`npm run db:check` runs `SELECT 1` through the same server-only Prisma client used by application services, prints a safe success/failure message, and disconnects. It never prints the connection URL. Its Node `react-server` condition allows the `server-only` marker in a server-side CLI; do not add that condition to browser or component-test commands.

### Environment loading

- Next.js loads environment files automatically; `DATABASE_URL` is accessed only by the server database module, which is protected by `import "server-only"`.
- Prisma CLI and `db:check` use `@next/env` to follow Next.js environment precedence: existing process variables, mode-specific local file, `.env.local` (except test mode), mode-specific file, then `.env`. The development mode is used unless `NODE_ENV=production` or `NODE_ENV=test` selects another mode.
- Prisma generation and schema validation require neither a connection URL nor a running database. If a nonempty URL is provided, it is validated. Actual database access always requires a valid PostgreSQL URL.
- Fast Vitest tests do not load local environment files and pass explicit configuration fixtures. They do not connect to the database. Integration tests use the dedicated service described below; they never load `.env.local`.
- Docker Compose uses the fixed development settings in `compose.yaml`; it does not receive `.env.local` or coaching credentials. If you change database settings, keep Compose and `DATABASE_URL` consistent.

### Stop, restart, and troubleshoot

```bash
docker compose stop
docker compose start
npm run db:check
```

`docker compose down` removes the container and network but preserves the named volume; `docker compose up -d --wait` reuses it. **Do not use `down -v` when you want to keep saved data.**

- Docker unavailable: start Docker Desktop/Colima and check `docker info`.
- Compose unavailable: try the standalone `docker-compose` command described above.
- Port 5433 busy: choose another localhost host port in `compose.yaml` and update the URL to match.
- Invalid/missing configuration: set `DATABASE_URL` in `.env.local` to a PostgreSQL URL with a host and database name.
- Connection failure: check `docker compose ps` and `docker compose logs postgres`, then verify host, port, and credentials. Initial database/user/password settings only initialize a fresh volume; changing Compose values does not update credentials in an existing database.
- Missing generated client: run `npm run db:generate` (also needed after installing with `--ignore-scripts`).

The setup follows the [Prisma client documentation](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction) and [Docker PostgreSQL guide](https://docs.docker.com/guides/postgresql/).

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Typecheck generates Next.js route types before running TypeScript, so it also works before the first development session. Lint runs separately from the build. To serve the production build locally:

```bash
npm run start
```

If the default Turbopack build fails with the known worker-port permission error, run `npm run build -- --webpack` before `npm run start`. This fallback is release-tested; the default failure remains recorded, not counted as a pass. For repeatable installation from the lockfile, use `npm ci`.

## Tests

```bash
npm test                            # Run all fast tests once and exit
npm run test:watch                   # Watch for changes; press q to quit
npm test -- --project=unit           # Node.js tests only
npm test -- --project=components     # DOM component tests only
npm test -- tests/components/home-page.test.tsx
```

Vitest uses two projects in `vitest.config.mts`:

- `tests/unit/**/*.test.{ts,tsx}` runs in Node.js for server-safe logic and rendering.
- `tests/components/**/*.test.{ts,tsx}` runs in jsdom with React Testing Library.
- `tests/setup-dom.ts` loads the jest-dom matchers and cleans up rendered components after every DOM test. Import `describe`, `it`, and `expect` from `vitest` explicitly.

Tests share the application's `@/` import alias. Use role-based DOM assertions for user-visible behavior and explicit fixtures or mocked adapters for engine/AI tests. The fast suite requires no running app, database, Stockfish, API key, or paid requests. Integration and Playwright browser tests have separate commands below.

Tests cover parsing, validation, engine protocols and classifications, orchestration, coaching contracts, dashboard states, and board/coaching navigation. jsdom does not replace browser verification; Playwright covers saved import-to-review journeys.

The setup follows the [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest), [Vitest environment documentation](https://vitest.dev/guide/environment.html), and [React Testing Library setup guide](https://testing-library.com/docs/react-testing-library/setup/).

## Database models and integration tests

`Game` stores the original PGN, explicit initial FEN, optional metadata, required user color, analysis status/error, and timestamps. `GameMove` stores canonical 1-based plies, actual move numbers, SAN/UCI, side, and before/after FENs. Player names remain nullable when PGN headers are absent. Played dates use PostgreSQL DATE; raw dates remain preserved in the PGN. `MoveEngineAnalysis` and `MoveCoachingAnnotation` store one assessment/annotation per move. There are no user or puzzle models.

PostgreSQL enums enforce valid game/move colors and analysis statuses. A unique `(gameId, ply)` constraint prevents duplicate plies within one game and supports ordered lookup. A foreign key rejects orphan moves and cascades game deletion to its moves; the game `(createdAt, id)` index supports stable library ordering. Queries must explicitly order moves by ply. The import UI saves validated games and their moves through POST /api/games using an atomic Prisma nested write.

Integration tests use a **separate PostgreSQL process**, database, and user on localhost port 5434. They use tmpfs instead of the development volume and do not start during normal `docker compose up`.

```bash
docker compose --profile test up -d --wait postgres-test
npm run db:generate
npm run test:integration
```

Use `docker-compose` instead of `docker compose` if that is your installed command. The runner verifies the connected database identity, applies checked-in migrations with `prisma migrate deploy`, then runs `tests/integration/**/*.test.ts` through `vitest.integration.config.mts`. The fast `npm test` command excludes these tests.

The test target defaults to the following development-only URL; no environment file is needed:

```text
postgresql://chess_coach_test:chess_coach_test_local@127.0.0.1:5434/chess_coach_test
```

If `TEST_DATABASE_URL` is supplied, it must exactly match that URL. An exported nonempty `DATABASE_URL` is refused even when the test URL is correct; unset it for this command. The runner deliberately does not load Next.js environment files. A separate Prisma configuration in `tests/prisma.config.ts` prevents development configuration from leaking into test migrations. Tests additionally verify `current_database()` and `current_user` before deleting only the game IDs created by that test process. There is no reset, truncate, or blanket delete operation.

The fixture suite verifies round-trip PGN/metadata/FEN/move ordering for both colors, duplicate ply and orphan rejection, database-level color constraints, analysis status/error storage, and cascading cleanup. Unit tests cover refusing substituted URLs and unexpected database identities without needing PostgreSQL.

To discard the ephemeral test database without touching the development service:

```bash
docker compose stop postgres-test
docker compose rm -f postgres-test
```

Its tmpfs data is disposable. Restarting it and rerunning `npm run test:integration` creates a fresh migrated test schema. Failed tests clean up their owned records when teardown runs; if a process is interrupted, recreating only this test container removes leftovers. Do not use project-wide `down -v` for test cleanup.

## Import a game

Open the home page and choose **Import a game**, or visit `/games/new`. Select White or Black, paste one PGN, and click **Import and Analyze**. The server validates both fields with Zod, parses the PGN, saves the game and all moves atomically with PENDING status, and returns the saved ID with normalized positions and the selected user color. Client-supplied positions are ignored.

The form has only three controls. Browser validation checks required fields, whitespace gets immediate feedback, and the server repeats validation independently. Inputs are retained after validation/connection errors and disabled during a pending submission. Single-game PGNs are limited to 100,000 characters.

A successful import navigates to `/games/[id]`, a permanent saved-game review, with metadata, a chessboard, a clickable move list, and Start/Previous/Next/End controls. The board defaults to your selected color and pieces cannot be dragged. The layout places the move list beside the board on wider screens and below it on narrow screens.

The game and its moves are **saved in PostgreSQL**. The `/games` library lists games newest first with players, result, played date, opening when available, and analysis status. Refreshing or reopening a review restores the saved moves and selected color, starting at the initial position. Data survives app and database restarts through the PostgreSQL named volume. Identical PGNs may be saved as separate games. After saving, the review starts Stockfish and then coaching. A missing provider key leaves a retryable engine-only review.

`POST /api/games` accepts JSON `{ "userColor": "WHITE", "pgn": "1. e4 e5 *" }` (or BLACK). Success returns HTTP 201 with `{ gameId, status: "PENDING", userColor, game }`; `game` contains the server-parsed replay DTO; the form navigates using `gameId`, and the review retrieves persisted data. Errors use `{ error: { code, message, fields? } }`: malformed JSON, invalid fields, and PGN errors return 400; unexpected parsing/storage failures return 500 with a sanitized message. Validation runs before database access. The import service accepts a repository interface, and the Prisma implementation saves the parent and all moves in one nested-write transaction. Integration tests exercise real storage, invalid input, duplicate-PGN imports, constraint-triggered rollback, and retry.

`GET /api/games` returns `{ games: GameSummary[] }`, ordered by createdAt descending and then ID descending. Its database query selects summary fields only, omitting raw PGN and moves. `GET /api/games/[id]` returns `{ game: SavedGame }` with metadata, selected color, status, initial position, and moves ordered by ply. Dates are ISO strings and DTOs are independent of Prisma. Missing games return 404 with `GAME_NOT_FOUND`; database errors return 500 with a sanitized `READ_FAILED` envelope.

The library and review are rendered dynamically from the database. Loading, empty library, missing-game, and retryable error states are provided. The home page links to the library, and reviews link back to it. Integration tests check summary/detail contracts, ordering, orientation, and missing records; browser verification covers import, reopen, refresh, and restart persistence.

### Replay position convention

`GameReview` owns one `selectedPly` state. Ply 0 shows `initialFen`, including SetUp/FEN positions. Selecting ply N shows that move's `fenAfter`, highlights the same move in the list, and updates the progress label. Previous/Next traverse half-moves; Start/End jump to the boundaries. Labels use the parsed full-move number and side, so a Black-to-move game starting at move 23 displays `23...`, not `1.`. A missing White move is shown as a dash in its column.

Evaluation and coaching panels use this same selected ply. Comparisons must label before/after evaluations explicitly, and a better alternative begins from the selected move's `fenBefore`, not the displayed resulting position. Flip board changes orientation without changing your saved color. Left/right arrows navigate moves except when typing in editable fields.

Replay component tests use the real react-chessboard renderer and verify all square/piece placements through the fixture game in both directions and orientations. Browser checks verify the responsive board and actual import-to-replay flow.

## PGN parsing

`parsePgn` in `lib/pgn/parse.ts` parses a single standard-chess PGN with chess.js 1.4.0. It is a pure, synchronous service: no database, engine, browser, or API calls. Its DTOs in `types/game.ts` expose only application-owned types, not chess.js objects.

The return value preserves the original `pgn`, the actual `initialFen`, nullable metadata, and every main-line half-move with a 1-based `ply`, actual full move number, color, canonical SAN, UCI (including promotion suffix), `fenBefore`, and `fenAfter`. Color describes the moving side, not the user's selected side; the import form supplies userColor separately.

Supported input and limits:

- Standard SAN movetext, optional headers, `1-0`, `0-1`, `1/2-1/2`, and unfinished `*`. Missing results default to `*`; contradictory header/movetext results are rejected.
- Custom starts require both `[SetUp "1"]` and a valid `[FEN "..."]`. Black-to-move starts retain their FEN move number. The normal starting position is not assumed for replay.
- Brace comments, semicolon line comments, NAGs, and nested recursive variations follow chess.js's PGN grammar. Only main-line moves are replayed and checked for legality; variation move legality is not checked. Comments/variations are preserved in the original PGN but not returned as annotations.
- Strict SAN uses `O-O`/`O-O-O` for castling. Coordinate notation, unsupported variants, null moves, malformed headers/comments/variations, and move-less input are rejected. Escaped quote characters inside header values are not supported by the selected chess.js grammar.
- One game per import. Further headers or movetext after a result marker are rejected with a multiple-game error; markers inside comments/variations/header values do not count as boundaries.
- Complete valid `YYYY.MM.DD` dates become UTC ISO strings; partial dates, impossible dates, and missing dates become null. Missing/unknown optional text headers are null.
- `metadata.result` is the recorded result. `finalPosition` separately describes board checkmate/stalemate/draw status. A supplied `Termination` header is retained; resignation, flagging, or an agreed draw is never guessed from the board.
- chess.js FEN output includes an en passant target only when a legal en passant capture exists. Raw PGN is kept unchanged, including its original FEN header.

Failures throw `PgnParseError` with a stable `code` (`EMPTY_PGN`, `INVALID_PGN`, `ILLEGAL_MOVE`, `UNSUPPORTED_PGN`, or `MULTIPLE_GAMES`) and an actionable message. Parser internals and raw input are not echoed in error messages.

Fixtures live in `tests/fixtures/pgn/`; run `npm test -- tests/unit/pgn.test.ts` for the parser suite. Move legality, SAN normalization, and FEN behavior follow the [chess.js documentation](https://jhlywa.github.io/chess.js/).

## Toolchain decisions

- Next.js 16.3.5, App Router, with React/React DOM 19.3.0.
- TypeScript 6.0.3 in strict mode. The latest TypeScript major was outside the installed TypeScript ESLint tooling's supported range when bootstrapping, so this compatible stable release is pinned.
- Tailwind CSS 4.3.3 through its PostCSS plugin and PostCSS 8.5.28.
- ESLint 9.39.5 with the matching Next.js 16.3.5 flat config, including Core Web Vitals and TypeScript rules. ESLint 9 keeps the React, import, and accessibility plugins within their supported peer ranges. npm marks ESLint 9 as unsupported upstream; upgrading to ESLint 10 must wait for these plugins to declare compatible peer dependencies.
- Exact direct dependency versions and the full resolved dependency tree are recorded in `package.json` and `package-lock.json`.
- Prisma CLI/client and the PostgreSQL adapter are pinned to stable 7.10.0; the npm `latest` Prisma CLI tag pointed to a prerelease during setup. PostgreSQL uses the official major-18 Docker image so patch updates stay within that major.
- Known dependency limitation: `npm audit` reports four high-severity entries in the Prisma dependency tree (Prisma/config, `deepmerge-ts`, and `mysql2`), including when dev dependencies are omitted. The suggested automatic fix downgrades to Prisma 6. No forced downgrade or unverified major dependency override was applied. This PostgreSQL app does not use the MySQL driver, and Prisma configuration is local trusted code; track upstream fixes rather than treating the audit as clean.
- System fonts keep the initial page and build independent of external font downloads.

Setup follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs). Node 24 is an LTS release listed in the [Node.js release schedule](https://nodejs.org/en/about/previous-releases).

## Project documents

- [Product and technical specification](CHESS_COACH_V0.1_SPEC.md)
- [Development tasks](TASKS.md)

## Local Stockfish adapter

The server-only entry point `getEngine()` in `lib/engine/client.ts` exposes `analyze(fen)`. Each call starts an isolated local process, performs the UCI/readiness handshake, searches one FEN, and closes the process before returning. It uses one thread, 16 MB hash, and one principal variation. The saved review can now start this engine through the analysis endpoint.

On macOS, download the matching binary from the [official Stockfish releases](https://github.com/official-stockfish/Stockfish/releases) and extract it outside the repository. Set `STOCKFISH_PATH` in `.env.local` to its absolute executable path (no shell command or arguments). If needed, grant that downloaded file executable permission with `chmod +x /absolute/path/to/stockfish`. A missing or non-executable binary produces a sanitized `UNAVAILABLE` error. The binary and its license are not bundled with this application.

| Environment variable | Default | Accepted values |
| --- | --- | --- |
| `STOCKFISH_PATH` | Required | Absolute executable path |
| `STOCKFISH_DEPTH` | 12 | Integer 1–30 |
| `STOCKFISH_MOVETIME_MS` | Unset | Integer 10–30,000; when set, replaces the depth search limit |
| `STOCKFISH_TIMEOUT_MS` | 30,000 | Integer 100–120,000; must exceed move time |

Initialization has a separate five-second deadline. After completion or failure, the adapter sends stop/quit and allows 250 ms to exit before SIGKILL. Cleanup is bounded at 1.5 seconds; failure to observe closure is reported as an error rather than a successful shutdown. Protocol buffers are bounded, stderr is drained, and timers/listeners/streams are released. No shell is used to launch the engine.

Run the separate, opt-in real-engine smoke test after configuring the executable:

```bash
npm run test:engine
```

It loads local environment settings, analyzes the starting position, verifies a legal best move and evaluation, and exits after shutdown. Ordinary `npm test` uses mocked processes and needs no installed engine. Stockfish 19's official macOS universal binary was verified during development using a temporary installation.

The [Stockfish UCI documentation](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-Protocol-and-Stockfish-Commands.html) describes the handshake, search commands, and scores. The application DTO keeps `perspective` as the FEN's side to move, `bestMove` as UCI (or null for no legal moves), and the latest scored primary `evaluation` with depth, PV, and exact/lower/upper bound. Mate values remain signed mate distances, separate from centipawns. Missing evaluations remain null; a terminal PV can be empty. Malformed scores, illegal PVs, and best moves inconsistent with legal moves are rejected. The analysis layer converts these results to White perspective and classifies moves.

This adapter analyzes standalone FENs, so earlier repetition history is unavailable. It does not pool processes, limit aggregate concurrent callers, or persist results; game orchestration handles persistence and per-game run ownership. Search results can vary by Stockfish version and search budget.

## Evaluation and move classification

`normalizeEvaluation(result, fen)` converts engine scores to White's perspective, including reversing lower/upper bounds when the sign changes. Mate scores retain their own kind and an explicit winner; mate zero is accepted only for a checkmated board, avoiding ambiguity when signed zero is serialized. Depth and PV remain available. A perspective/FEN mismatch is rejected.

`assessMove({ fenBefore, move, before, after })` validates the played UCI move, derives the resulting position, and returns a versioned assessment with normalized before/after facts, positions, mover, best move, legal-move count, and terminal state. These DTOs are ready for TASK-012 persistence; no database changes or engine execution are introduced here.

Policy version 1 uses mover-relative loss: White's before-minus-after evaluation for White, and its negation for Black. Loss below 20 cp is normal, 20–49 is an inaccuracy, 50–99 a mistake, and 100+ a blunder. Negative apparent loss is retained as `rawCpLoss`, clamped to zero for `cpLoss`, and flagged as search disagreement. A best-move match with a reported loss of 20+ cp is left unknown because the independent searches conflict. Near-equivalent moves below 20 cp are normal without needing to match the engine's first choice.

Safeguards and limitations:

- A board-proven only legal move or a delivered checkmate is normal, independently of engine estimates. No centipawn loss is fabricated for these cases.
- Missing or bound-only scores and searches below depth 8 produce unknown quality and null loss. Depth 8 is an initial heuristic confidence floor, not a guarantee of accuracy.
- When both cp evaluations remain at least 800 cp on the same side of equality, a mistake/blunder is capped at inaccuracy; the full raw loss is preserved. Crossing equality or dropping below that threshold is not capped.
- Finding or retaining a winning mate is normal; losing that mate is a blunder. Allowing a new opponent mate is a blunder. Retaining an already lost mate or escaping it is normal. Changes in mate distance alone are not penalties, and mate values are never converted to centipawns. These judgments are provisional engine findings, not proof that the move was difficult or brilliant.
- A board-proven terminal draw uses an exact outcome of zero for comparison, while retaining the supplied engine facts separately. Losing a previously reported winning mate to a draw counts as a missed mate.

Standalone positions do not carry repetition history; historical draw detection and deeper-search confirmation remain limitations. The policy only labels move quality and preserves the evidence needed to recalculate it. It does not infer puzzle suitability or produce AI coaching.

## Saved-game engine orchestration

`analyzeSavedGame(id)` in `lib/analysis/client.ts` connects the database and configured local engine to the testable `analyzeGame` application service. The review-page action calls the synchronous HTTP execution endpoint described below. Apply the additive migration before using it:

```bash
npx prisma migrate deploy
npm run db:generate
```

The service claims a PENDING or FAILED game as ENGINE_RUNNING, analyzes its initial position and each subsequent position sequentially, and reuses the preceding result for the next move. A normal N-ply game requires N+1 engine searches; board-proven terminal checkmates/draws require no search. It validates the saved move chain and checks engine best moves/PVs for legality, deriving SAN from each variation's own starting FEN. Standalone FEN evaluation retains the repetition-history limitation described above.

`MoveEngineAnalysis` has a unique relation to each `GameMove`, with White-perspective before/after cp or mate columns, best move in UCI/SAN, primary PV in UCI/SAN, loss, and classification. Versioned assessment JSON retains both normalized scores, bounds, depth, PVs, explicit mate winner, raw loss, and classification evidence. Configuration JSON records search depth/move time, timeout, threads, hash, MultiPV, engine family, and adapter version; it excludes executable paths. The executable's exact Stockfish release is not currently reported by the adapter. Each row also records a run ID and analysis timestamp.

Each move result is committed independently with an upsert, outside engine searches. ENGINE_COMPLETED is set only after all writes succeed. On failure the imported game/moves and earlier committed assessments remain; the game becomes FAILED with a sanitized message. A retry replaces each move's existing assessment without duplicate rows. Partial retries can contain rows from different runs, distinguishable by run ID/configuration/timestamp. If the database cannot record failure status, the service returns STORAGE_FAILED; interrupted-run recovery uses the lease mechanism below. Completed games are not automatically reanalyzed.

The deterministic integration suite covers position reuse, correct game/ply mapping, White-perspective storage, SAN, terminal checkmate/stalemate, malformed PV rejection, partial engine/storage failures, configuration errors, and retry upserts. No live Stockfish executable is needed for these tests.

## Run, retry, and recover analysis

Import with **Import and Analyze**, or open a pending saved review and choose **Analyze game**. After a failed run, choose **Retry analysis**. **Refresh status** retrieves the persisted stage; an interrupted connection does not prove that the server stopped working. Configure a durable `STOCKFISH_PATH` first, as described above. Saved engine results appear in the move-synchronized panel described below.

`POST /api/games/[id]/analyze` uses a synchronous Node.js route that awaits the full service call. Success returns HTTP 200 with `{ engine, coaching }`; coaching-only retries reuse the saved engine stage. Errors use `{ error: { code, message } }`: missing game is 404/GAME_NOT_FOUND; active or already completed work is 409/ANALYSIS_NOT_READY; analysis/storage failure is 500 with its service code; unexpected startup failure is 503/ANALYSIS_UNAVAILABLE. No untracked background promise or external worker is started. `GET /api/games/[id]` also exposes sanitized analysisError and analysisLeaseUntil, never the ownership token.

A conditional database update acquires a five-minute lease with a unique ownership token. Each committed move renews it. The lease exceeds two consecutive maximum-duration adapter searches (each at most 120 seconds plus initialization/cleanup), which covers the initial before/after pair. Short transactions fence every move write and completion by token and live lease; a recovered run cannot be overwritten by its old owner. Separate requests use separate repository instances. Failed runs can retry immediately; running runs can only be reclaimed after lease expiry. Legacy ENGINE_RUNNING rows without a lease are recoverable immediately. Imported data and prior move assessments remain intact, and upserts keep one assessment per move.

After a process crash or restart, open the same review, wait until the displayed recovery deadline, and choose **Retry analysis**. The server checks expiry rather than trusting browser time. Refresh while an existing run is active to see its persisted stage. A hard restart can leave the old run marked ENGINE_RUNNING until recovery; the app does not erase valid ownership just because a new process started. Different games may run concurrently; aggregate engine concurrency remains a local resource consideration.

Verification used an actual server interruption during a real Stockfish search, restart, a 409 before expiry, and browser retry after moving only the marked test fixture's lease past its deadline. Recovery completed a four-ply game at depth 12 in about 1.4 seconds and persisted completion across refresh. The five-minute production interval was not shortened. This validates the local synchronous setup for that measured workload; long games and larger budgets can take minutes. Hosted request-timeout constraints have not been validated. Future deployment must measure representative game durations before retaining synchronous execution.

## Review engine results

After analysis, the saved review displays current-position evaluation, classification, mover-relative loss, the engine's suggested move, and up to eight SAN half-moves of its primary variation. Scores are explicitly from White's perspective. At ply zero the panel shows the first assessment's before-position score. At ply N the current score comes from that move's after-position evaluation, while its before score is labeled separately. The engine choice and suggested line start before the played move; selecting them does not explore an alternate board line.

Inaccuracy, mistake, and blunder markers are clickable and share the board/move list's existing selected-ply state. Mate distances/checkmate, score bounds, unavailable evaluations, and unknown classifications have distinct text rather than misleading pawn numbers. The displayed depth and heuristic note describe the limits of engine estimates. There is no OpenAI dependency in this flow.

The review reports how many moves have saved assessments, labels partial coverage, and warns if results span multiple retry runs. Existing analysis controls expose pending/running/failed/completed status and retry. Unanalyzed moves keep a usable replay and display a missing-analysis message. The detail query selects engine review fields only; summary/list queries stay small. Persisted assessment JSON is validated at the DTO boundary, with unsupported or malformed versions shown as unavailable instead of cast into the UI.

## Instructional-moment selection

`selectMoments({ userColor, moves, assessments, limit })` is a pure, deterministic selector used by the coaching stage. The default cap is eight moments; callers may request 1–10. It returns chronological plies with mover/SAN, user-loss/positive/opponent-context kind, and structured evidence containing the relevant normalized scores and loss. It does not call an engine or model, modify the game, or add review UI.

Selection prioritizes the user's mate missed/allowed, major advantage reversals (at least +100 to −100 cp from the mover's perspective), then meaningful losses of at least 20 cp. Within a severity class, larger losses rank first and earlier plies break ties. When available, it reserves room for supported user positives and opponent mistakes that explain opportunities, capped at two of each. Remaining room can be filled with user losses. A two-ply exclusion window suppresses nearby candidates on either side of the same short sequence; this is a proximity heuristic, not tactical-sequence recognition.

Positive evidence is limited to supplied mate-found, mate-escaped, or delivered-checkmate facts. Best-move agreement or small loss alone does not earn a highlight. Unknown, shallow, bounded, forced, overwhelming-position, and search-disagreement assessments are excluded. Checkmate evidence does not require a deep terminal search. Assessments must match the known move/color/before-and-after FENs; unknown or ambiguous duplicate plies are discarded. Sparse games can return fewer than five moments or none. Educational categories and explanations remain the coaching stage's responsibility.

## Coaching contract

`lib/coaching/contract.ts` defines the versioned schema and cross-check used before any coaching response is persisted.

`coachingResponseSchema` (Zod) validates the raw model output: `schemaVersion: 1`, a `summary` up to 500 chars, `strengths` and `improvements` arrays up to five items each (200 chars per item), and `criticalMoments` up to ten items. Each moment requires a `ply`, a `classification` from the allowed set (`normal`, `inaccuracy`, `mistake`, `blunder`), a nullable `headline` (100 chars), an `explanation` (600 chars), a `lesson` (400 chars), and a `category` from the centralized 25-value list in `COACHING_CATEGORIES`. The model may never supply `"unknown"` as a classification.

`crossCheckCoachingResponse` runs semantic checks against the game's plies and selected moments: unknown plies, plies not in the selected set, and duplicate plies are all rejected with typed errors. All errors are collected before returning so every problem is visible in one pass.

**Classification normalization rule:** when the engine has a non-null, non-`"unknown"` quality for a ply, `effectiveClassification` uses the engine value regardless of the model's claim. If the engine quality is absent or `"unknown"`, the model's classification is used. Both `modelClassification` and `engineQuality` are preserved in the DTO for traceability.

## Coaching prompt

`buildCoachingPrompt({ userColor, game, moments, momentFacts })` in `lib/coaching/prompt.ts` is a pure function that assembles the structured coaching request. It returns a `systemPrompt`, a `userMessage`, and a `responseSchema` (JSON Schema for the model's structured-output API). No network calls are made here.

The system prompt tells the model that Stockfish data is authoritative, forbids inventing moves or evaluations, and constrains output to the allowed categories and schema. The user message includes optional game metadata, and one block per selected moment containing: ply, played move (SAN and UCI), `fenBefore`, `fenAfter`, White-perspective evaluations with depth, the engine's best move and principal variation (SAN and UCI), and centipawn loss from the mover's perspective. Missing optional metadata fields are omitted. Zero selected moments requests a summary-only response with empty `criticalMoments`.

The V0.1 player rating is the documented default of 1400 Lichess rapid. There is no UI control for it.

## Progress and recovery (TASK-023)

**Import and Analyze** first saves the game, then opens its permanent review URL and starts analysis. Refreshing or closing that review keeps the saved game accessible from **Your games**. A refresh never automatically retries failed work. If navigation is interrupted before analysis starts, open the saved game and choose **Analyze game**.

The review refreshes persisted stages every two seconds while a request or saved run is active. Stockfish saves move results incrementally; coaching generation, validation, and saving share the persisted AI_RUNNING stage. There are no estimated percentages or separate fictitious saving stages. Board selection survives these route refreshes. Active runs disable retry until the lease deadline; the server remains authoritative if another tab has stale state. Interrupted ENGINE_RUNNING and AI_RUNNING runs can both recover after their five-minute lease expires.

**Retry coaching** reuses saved engine results. The endpoint now selects the stage from the database before attempting a claim and returns `{ engine, coaching }`; a coaching failure can return HTTP 200 with `coaching.status: "AI_FAILED"`, while preserving engine review. Conflicting claims return HTTP 409. No background worker is required; the POST request awaits both stages.

For missing-engine failures, check `STOCKFISH_PATH` and executable permissions. Choose Anthropic (Claude) or OpenAI (GPT) in **Settings**, configure its `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in `.env.local`, restart, then choose **Retry coaching**. Missing keys do not issue a network request. For database failures, start local PostgreSQL and retry loading the review; import failures retain the form input. Saved analysis errors contain safe application messages, not raw service exceptions.


## Home dashboard

The home page shows the total saved-game count and the five most recently imported games, with links to their reviews, **Import Game**, and **My Games**. Counts and summaries load from PostgreSQL on each page request; detailed moves and analysis are loaded only when opening a review. An empty library points to import, while a database outage preserves navigation and offers **Try again** to reload after restoring PostgreSQL.

## Browser regression suite (TASK-025)

Use Node 24.15+ and the dedicated PostgreSQL test service. Install the Chromium version pinned by the Playwright lockfile once:

```bash
npx playwright install chromium
docker compose --profile test up -d --wait postgres-test
npm run test:e2e
```

Unset `DATABASE_URL` in the shell first; the runner deliberately refuses an exported development URL. It verifies the database name/user and deploys migrations using the same fixed `chess_coach_test` target on port 5434 as integration tests. Run these suites sequentially. The browser runner deletes only games marked with its unique run ID, including on ordinary test failure. A forcibly killed runner may leave marked fixtures in the disposable test database.

Playwright starts its own webpack development server on `127.0.0.1:3100`, refuses to reuse an existing server, and writes generated output to `.next-e2e`. Three Chromium journeys cover Anthropic/White at desktop width, OpenAI/Black at 390px, and an unavailable-provider case. Coverage includes settings persistence, explicit cross-provider regeneration with failure preservation and stale-request rejection, plus: illegal PGN/input retention, import and automatic analysis, engine-only review after coaching failure, refresh, successful coaching retry, saved-library reopening, direct/critical/summary move selection, actual rendered board pieces, stale-annotation removal, button/keyboard navigation, and duplicate-analysis rejection. Database assertions verify that coaching retry leaves every engine row unchanged and saves exactly one annotation per selected move. The Prisma assertion helper runs through `tsx` because Playwright's CommonJS transformer cannot load the generated Prisma ES module directly.

Test mode is enabled only by `CHESS_E2E_MODE=deterministic` together with a run ID, the exact isolated database URL, and Next's development-server phase. A visible server warning identifies it. Production builds/start reject test mode; normal development selects real services. Next's test-only module replacement substitutes the engine and coaching adapters without replacing routes, parsing, orchestration, validation, persistence, or the board. The mock engine supplies explicit synthetic 50cp-loss facts with legal one-move PVs; these are not real evaluations. Mock coaching fails its first request per unique game/provider in each route bundle, then passes a fixture through the actual response schema and semantic validator. Explicit fixture metadata identifies cross-provider replacements, which return fewer annotations to verify obsolete-row removal. The missing-key fixture returns a deterministic missing-key outcome. The runner restores the isolated database’s previous settings after tests. API keys are blank in the test server, and its engine path is deliberately non-executable. Do not put these test switches in `.env.local`.

Failed runs retain traces under `test-results`; inspect one with `npx playwright show-trace <trace.zip>`. Narrow/repeat runs work through `npm run test:e2e -- --grep WHITE` or `npm run test:e2e -- --repeat-each=2`. Configuration follows the bundled Next.js testing guide and [Playwright web-server guidance](https://playwright.dev/docs/test-webserver). This small suite uses development compilation; separately verify the normal production build. On this machine the documented Turbopack worker-port limitation still requires `npm run build -- --webpack`.

### Separate manual real-service check

Keep `npm run test:engine` separate from deterministic tests. Configure a real `STOCKFISH_PATH` as described above; this smoke test performs a real search and verifies shutdown.

For a manual complete workflow, launch normally with all `CHESS_E2E_*` variables unset, a real Stockfish executable, and the chosen provider’s key configured locally. Select the provider in **Settings** before importing. Import `samples/demo.pgn`, select your color, and check that analysis completes, summary moments select the corresponding board position/explanation, and coaching survives reload and reopening from Your games. Repeat for the other color. To check recovery, start without the API key, import a new game, verify saved engine results, then configure the key, restart, and choose **Retry coaching**. This manual check makes a paid provider request; automated suites never do.

TASK-025 verification used real Stockfish 19 from its [official release](https://github.com/official-stockfish/Stockfish/releases/tag/sf_19), temporarily outside the repository. Live coaching was skipped because neither Anthropic nor OpenAI credentials were configured. No live OpenAI verification was performed in TASK-025. TASK-027 adds OpenAI alongside Anthropic; see the release evidence for remaining live verification.

## Sample import-to-review walkthrough

Use [samples/demo.pgn](samples/demo.pgn), a 33-ply legal checkmate example with fictional player labels and no account identifiers. Its moves reproduce the public-domain Opera Game; the labels do not identify a user's game. It is a short demonstration, not a representative rapid-game benchmark.

1. Start the stack above. Open **Import Game**, select White, paste the entire sample, and choose **Import and Analyze**.
2. The saved review opens immediately. Keep it open while Stockfish runs; persisted stages update automatically. Without a key, expect an engine-only review and **Retry coaching**.
3. With a working key for the selected provider, expect a saved summary and selected explanations after validation. Ordinary moves may have no annotation; positive highlights appear only when supported by the selection policy.
4. Click a critical move or summary moment. Board, evaluation, and explanation must select the same ply. The board shows the position after that move; the suggested alternative starts before it.
5. Try Start/End, Previous/Next, left/right arrows, and Flip board. The sample ends with `17. Rd8#`. Refresh, then reopen the game from **My Games**; data and selected color remain saved, while selection resets to the initial position.
6. Import again as Black to check the other orientation/coaching perspective. Duplicate imports are intentionally separate saved games.

Coaching sends game metadata and selected positions/engine facts to the configured provider. Only the sample's fictional metadata is needed for this walkthrough. For a live failure/retry check, follow the separate manual real-service check above.

## Fresh-database setup verification

To verify setup without touching your development database, create a uniquely named database in the disposable test service. Do not run integration/browser suites concurrently with this check. These commands use a separate database from those suites and do not edit `.env.local`:

```bash
docker compose --profile test up -d --wait postgres-test
docker compose exec -T postgres-test createdb -U chess_coach_test task026_release
export DATABASE_URL=postgresql://chess_coach_test:chess_coach_test_local@127.0.0.1:5434/task026_release
npm ci
npx prisma validate
npx prisma migrate deploy
npm run db:check
npm run dev -- --webpack --port 3002
```

Choose an unused database name and update the URL if that name already exists; never reset an existing database to make this check pass. Open port 3002 and follow the sample walkthrough. Stop the app, restart it with the same exported URL, and reopen the saved review. When finished, stop the app and `unset DATABASE_URL` before running integration/browser tests. The temporary database can be kept for inspection or removed explicitly by name; do not remove the development volume.

## Troubleshooting coaching and analysis

- Missing key or authentication error: check the selected provider in **Settings**, set its `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in `.env.local`, restart, and choose **Retry coaching** (or **Regenerate coaching** for a completed review). Keys are not interchangeable.
- Rate limit, timeout, invalid response, or provider failure: engine results remain saved. Retry coaching after the service recovers; retries validate the response again and reuse engine rows.
- Stockfish unavailable: check the absolute path, CPU/OS compatibility, and executable permission, then run `npm run test:engine`. Download from the [official Stockfish page](https://stockfishchess.org/download/); macOS universal binaries select CPU features automatically. Linux/Windows binaries are available there but are not release-tested here.
- Engine timeout: reduce depth or set a bounded move time; keep timeout above move time. Larger search budgets increase total duration.
- Interrupted run or duplicate request: refresh the saved review. Wait for the displayed five-minute lease deadline before retrying; do not modify database lease values manually.
- Database unavailable or missing tables: start PostgreSQL, verify `DATABASE_URL`, apply `npx prisma migrate deploy`, and run `npm run db:check`.
- Node/jsdom failures: confirm Node 24.15+ is active in the terminal running the command.
- Build worker-port error: use `npm run build -- --webpack`. See the release evidence for the unresolved default-build limitation.

Known limits and measured durations are recorded in [release acceptance](docs/release-acceptance.md). The setup uses checked-in migrations via [Prisma migrate deploy](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production); use `migrate dev` only when authoring schema changes.


## Choose Claude or GPT (TASK-027)

Apply the new additive migration before starting the app:

```bash
npx prisma migrate deploy
npm run db:generate
```

Open **Settings** in the header, choose **Anthropic (Claude)** or **OpenAI (GPT)**, and click **Save provider**. The saved default lives in PostgreSQL and survives browser/server restarts. A fresh installation defaults to Anthropic for compatibility. Settings shows only whether each key is configured, not its value or whether the provider will accept it. Either choice can be saved while its key is unavailable; requests fail with configuration guidance instead of silently switching providers. The import form remains unchanged.

| Provider | Server-only key | Configured model | Structured-output API |
| --- | --- | --- | --- |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | `claude-haiku-4-5` | Messages `output_config.format` |
| OpenAI (GPT) | `OPENAI_API_KEY` | `gpt-5.4-mini` | Responses `text.format`, strict JSON schema |

The model choices are fixed in `lib/coaching/providers.ts`, not user-entered request data. GPT uses low reasoning effort and an 8,192-token output budget; Claude uses 4,096 output tokens. These defaults are supported by the [GPT-5.4 mini model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [OpenAI structured-output guide](https://developers.openai.com/api/docs/guides/structured-outputs), and [Claude structured-output guide](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). OpenAI SDK 7.23.0 was added; the existing Anthropic SDK was retained. Live account access and output quality have not been verified without credentials.

Changing the default does not alter existing reviews or make an API request. Each coaching run captures the saved provider and configured model when coaching starts, including after engine analysis completes. A setting changed during that request applies to subsequent runs. Saved summaries and annotations record the provider and actual response model, displayed on the review. Legacy coaching is attributed to Anthropic while preserving its original model and text.

On a completed review, **Regenerate coaching** explicitly requests coaching with the current saved default. It reuses every Stockfish row. The previous coaching remains visible during generation; a successful replacement commits the summary, provider/model, complete annotation set, and COMPLETED status together. Obsolete annotations are removed. Provider or storage failure preserves the previous valid review and reports an error; retry using the same button. Failed first-time coaching retains ENGINE_COMPLETED and **Retry coaching**. There is no version history or side-by-side comparison.

`GET /api/settings` returns `{ provider, available: { ANTHROPIC, OPENAI } }`; `PUT /api/settings` accepts only `{ provider: "ANTHROPIC" | "OPENAI" }`. Unknown fields/providers and malformed input return 400. `POST /api/games/[id]/coaching` accepts only `{ expectedRevision: number }`, taken from the saved review’s `coachingRevision`. Each successful claim increments that revision and records the run’s provider/model. Stale revisions or active leases return 409, even if an earlier request finished before a delayed duplicate arrived. The ordinary analyze endpoint still refuses completed games. The ownership token remains server-only.

Both SDKs have a 120-second timeout with automatic retries disabled. An application deadline aborts generation at 150 seconds and ignores late results, leaving room to record failure within the five-minute lease. Token and live-lease checks fence both success and failure writes. Recovery after a server interruption retains previous coaching and can reclaim work after expiry. A recovered attempt starts a new run using the current saved default.

Both providers receive the same prompt and a compatible shape/enum schema. Unsupported wire length/range constraints are removed without weakening the original Zod validator: all lengths, ranges, categories, duplicate/unknown/unselected plies, and authoritative engine classifications are still checked before persistence. Provider errors are sanitized. OpenAI response storage is disabled with `store: false`; both requests send game metadata and selected engine facts to the chosen provider.

For live acceptance, run the sample for White and Black with each provider, verify the provider/model label and correct moment/board synchronization, reload/reopen the reviews, switch providers and regenerate, and record response duration. Exercise a missing-key attempt followed by configuration/restart and retry, checking that old coaching and engine results survive failure. These are paid requests; automated suites use explicit fixtures. Neither key was available during TASK-027, so both live checks remain blocked under TASK-026.
