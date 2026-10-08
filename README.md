# Chess Coach App

A local chess-improvement application for importing PGNs, analyzing games with Stockfish, and reviewing them with AI coaching.

The app supports email/password accounts, a private saved-game dashboard, PGN import, Stockfish analysis, validated AI coaching, synchronized board review, and validated one-move puzzle generation and practice. Multi-move puzzles, learning plans, weakness statistics, and deployment are deferred; see [future tasks](FUTURE_TASKS.md).

**Release acceptance is blocked:** live coaching credentials are unavailable and the default Turbopack build has an environment limitation. Both Anthropic and OpenAI are implemented; live provider checks remain unverified. Engine-only review works without a provider key. See [release evidence](docs/release-acceptance.md) for checks and limitations.

## Accounts and existing games

Open `/register` to create your email/password account. Passwords must contain 12–128 characters. Registration signs you in; `/sign-in` restores access later. **Account** opens your profile and password-change form; **Sign out** revokes the current session. Password changes sign out other devices. Sessions expire after seven days, with renewal after a day of activity.

Games, dashboard counts, analysis, coaching regeneration, and provider preferences are private to the signed-in user. Import ownership comes from the session, never from request data. Unknown and other users' game IDs both return 404. API clients must send the app's exact `Origin` on write requests and include a valid session cookie. Server API keys remain shared installation configuration; each user chooses their own provider.

The additive auth migration preserves all existing games, moves, engine results, and coaching. Pre-auth games initially have no owner and are hidden from accounts, including the first registrant. After registering your account, stop the app and explicitly assign the legacy library to your email:

```bash
npm run auth:admin -- claim-legacy you@example.com
```

This assigns only unowned games. It copies the old local provider preference only if the target account has no preference yet; existing personal settings win. Repeating the command is safe. It refuses unfinished legacy analysis. Complete or recover any such analysis with the previous version before upgrading, then retry. Restart the app and reopen your library; review URLs remain unchanged. No ownership transfer is exposed to browser users.

### Local password recovery

If you forget your password, stop the app and run this on the machine hosting the database:

```bash
npm run auth:admin -- reset-password you@example.com
```

Enter and confirm the new password at the hidden prompts. Never put a password in command arguments. The command replaces the credential hash and revokes every session for that account, preserving its identity and games. Restart the app and sign in. `/account-recovery` explains this local recovery path; this release does not send reset or verification emails.

Authentication uses [Better Auth's email/password support](https://better-auth.com/docs/authentication/email-password), [Prisma adapter](https://better-auth.com/docs/adapters/prisma), and [Next.js integration](https://better-auth.com/docs/integrations/next). Credentials are stored separately from user identity; Google can be added later without changing game ownership. Automatic account linking is disabled because local email addresses are not verified. A future public launch should add email verification/delivery and explicit linking before enabling social login.

Auth cookies are HttpOnly/SameSite and secure on HTTPS. Session validation uses the database without a cookie cache; application reads and writes enforce ownership on the server. [Database-backed rate limits](https://better-auth.com/docs/concepts/rate-limit) apply even in development: 10 sign-in attempts, 5 registrations, and 5 password changes per IP per minute. Hosting must use a trusted proxy that overwrites forwarded client-IP headers; rate limiting is not a substitute for configuring that boundary. The current server binds to loopback.

Fast tests mock sessions explicitly for existing features and test missing/expired-session and cross-origin guards separately. Integration tests exercise real credential hashing, cookie sessions, expiry, logout, local recovery, rate limits, two-user isolation, and migration in a temporary schema. Browser tests use real auth against the dedicated test database; only engine/coaching calls are mocked. Test credentials and auth secrets are isolated fixtures, not an auth bypass.

## Prerequisites

- Node.js **24 LTS, version 24.15.0 or later** (verified with 24.21.0), with npm 10 or later.
- If you use nvm, run `nvm install` and `nvm use` in this directory; `.nvmrc` selects Node 24.
- Development, build, and start commands check the active Node version before launching. If Herd or another shell setup selects Node 20, run `nvm install` and `nvm use` in this project, then restart the app. PDF.js initialization needs the Node 24 runtime; running the existing server under Node 20 can fail PDF uploads even when installation succeeded.
- Confirm `node --version` prints `v24.x` before installing dependencies. The project declares Node 24 in `package.json` to keep development consistent.

Docker with Compose is required (Docker Desktop or a running Colima engine on macOS). Install a local Stockfish executable for analysis. Coaching uses an optional paid Anthropic or OpenAI API key; without it, engine results remain available. The verified environment is macOS arm64, Node 24.21.0, PostgreSQL 18, and Stockfish 19. Other operating systems have not received release verification. Fast tests require none of these external services.

## Local development

1. Activate Node 24 and start Docker.
2. If `.env.local` does not exist, copy `.env.example` to `.env.local`; preserve existing values.
3. Set `DATABASE_URL` as shown below and `STOCKFISH_PATH` to an absolute executable path from the [Stockfish setup](#local-stockfish-adapter).
4. Set `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` for live coaching, then select the provider in **Settings**. The default is Anthropic; missing keys do not trigger fallback. Models are configured in `lib/coaching/providers.ts`; there is no model environment override. Keep keys server-side, never use `NEXT_PUBLIC_`, and restart after changing keys.
5. Set `BETTER_AUTH_URL=http://127.0.0.1:3000` and a random `BETTER_AUTH_SECRET` of at least 32 characters in `.env.local`. Generate a secret with `openssl rand -hex 32`; keep it stable across restarts and out of Git. Use the exact URL in your browser (including port); update this setting if you run on another port. Remote hosting requires HTTPS.
6. Run:

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

`Game` stores the original PGN, explicit initial FEN, optional metadata, required user color, analysis status/error, and timestamps. `GameMove` stores canonical 1-based plies, actual move numbers, SAN/UCI, side, and before/after FENs. Player names remain nullable when PGN headers are absent. Played dates use PostgreSQL DATE; raw dates remain preserved in the PGN. `MoveEngineAnalysis` and `MoveCoachingAnnotation` store one assessment/annotation per move. Accounts and sessions use separate auth models. `PuzzleGeneration` stores versioned generation status/configuration and `PersonalPuzzle` stores validated positions and solutions; their ownership follows the source game. `PuzzleProgress` records one completion per user/puzzle and current practice state; `PuzzleAttempt` separately records moves, hints, reveals, and retries.

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

## Explore review positions (TASK-028)

Choose **Explore position** on a review to play legal moves for both sides from the selected recorded position. **Try the better move** starts before the selected move so you can try the engine suggestion yourself. Drag pieces, click a source and destination, or enter coordinates such as `e2e4`. Choose the promotion piece before moving, or enter a suffix such as `a7a8n` for a knight.

**Undo** removes one explored move; **Reset variation** restores the exact exploration starting position. **Return to review** restores the previously selected recorded position and annotations. Selecting a recorded move or using Start/Previous/Next/End exits exploration; Start still means the beginning of the imported game. Left/right review shortcuts are suspended during exploration.

Variations are temporary and disappear when you leave exploration or reload. They never change the saved PGN or analysis. Recorded evaluations and coaching are hidden during exploration; this version has no live engine evaluation or automatic opponent replies. Checkmate and draws stop further play until you undo or reset.

On both review and exploration boards, hold the right mouse button and drag between squares to draw an orange arrow. Hold Shift for blue arrows. Repeat the same arrow to remove it, or left-click the board to clear all arrows. Arrows clear when the displayed position changes and are never saved with the game. Knight moves use bent arrows.


### Puzzles from your games

After engine analysis finishes, use **Generate puzzles** in the **Puzzles from this game** section below a saved review. Coaching is optional. Generation runs only when requested, uses local Stockfish, and leaves the review unchanged. The page reports the saved puzzle count or an honest empty result. Choose **Practice these puzzles**, or open **Puzzles** in the header, to solve them.

The original policy v1 checks at most five of your largest mistakes/blunders with saved loss of at least 100 centipawns. Each starting position is searched at depth 14 with two principal variations, one thread, 16 MB hash, and a 30-second search timeout. Both lines must be legal, exact, and reach the same depth; the best move must agree with saved analysis and differ from the played move. Accept either a winning score of at least 200 cp with at least 150 cp separation from the runner-up (or a runner-up losing by mate), or a mate within five moves where the runner-up is not a winning mate and scores at most 500 cp. Only the unique best move is accepted. These conservative thresholds can skip useful positions. Searches use the starting FEN, without reconstructing earlier repetition history.

Current policy v2 keeps those root thresholds and extends each accepted puzzle to at most three solver moves (five total plies). Each opponent position and subsequent solver position gets a fresh depth-14 MultiPV search. Opponent replies require complete exact legal evidence; subsequent solver moves must again be uniquely winning/mating, or be the sole legal winning move. Ambiguous or incomplete continuations end at the last validated solver move. The puzzle ends at checkmate, a terminal position, or an explicitly labeled validated sequence boundary. Generation initially accepts one move per solver position; the stored branch format also supports independently validated alternatives. Up to 25 position searches can be needed, so generation can take longer than v1.

The policy and engine evidence are saved with each generation. Completed generations, including empty results, are reused for that game/policy version. Failed runs can be retried; active runs renew their lease before each position search, and interrupted runs become retryable five minutes after their last renewal. Results publish atomically, and old workers cannot overwrite a recovered run. Account ownership is checked through the source game; solutions are not included in the browser's generation summary. Existing v1 definitions and progress remain playable; choose Generate puzzles again on a previously generated review to create separate v2 definitions and progress without rewriting them. Future policy changes must increment the version to create new definitions.

Existing installations should run `npx prisma migrate deploy` and `npm run db:generate` after updating. The additive puzzle migration creates two tables without rewriting games or analysis.


### Solving puzzles and saved attempts

The puzzle library at `/puzzles` shows your saved definitions and whether each is unfinished, revealed, or completed with/without assistance. A game-specific practice link filters the library; pages show at most 24 puzzles. Open a puzzle to play its validated sequence using drag/drop, source/destination clicks, or keyboard coordinates such as `e2e4`. Select a promotion piece before moving, or include its letter in coordinates (`a7a8n`). The board faces your color.

Answers are checked by the server against chess legality and the puzzle's stored solution branch at the current position. Illegal and legal-but-incorrect moves leave that position available for another try; accepted alternatives use their own continuations. A correct intermediate move and its precomputed opponent reply save atomically; the board then waits for your next move. The played sequence is visible, refresh resumes the same position, and completion is recorded only at the end of the line. Inputs are locked while a request is unresolved, preventing duplicate moves or restart during an unsaved reply. The browser receives no solution list or engine evidence before solving. **Hint** saves assistance and reveals the source square for the next move in your current branch. Advancing clears the visible hint but retains assistance. **Reveal solution** shows the entire matching line and its final position but does not mark the puzzle completed. **Retry puzzle** restores the starting position; assistance stays recorded across retries and reloads. Practicing after seeing a completed solution is also assisted.

The first successful completion, its date, and whether it was assisted are retained permanently for that puzzle version. Later practice does not inflate completion counts or replace that first result. Move attempts and help/retry actions are separate records. Concurrent tabs use revision checks, and retrying a request after a lost response reuses its request ID to avoid duplicate attempts. Progress is private to the signed-in owner. Use **Next puzzle** to continue through the same game's generation, or **Return to source review** to open the recorded move that produced the puzzle.

The `20261001120000_puzzle_attempts` migration adds progress and attempt tables. TASK-033 adds the `20261002100000_puzzle_sequences` migration for nullable solution definitions and saved sequence histories. Apply migrations and regenerate the Prisma client after updating. Existing one-move puzzles and completions are preserved.


## Books and PDF reader (TASK-034)

Open **Books** in the header or `/books` to import PDFs, reopen a book at its saved page, and keep checkmarks at specific spots on each page. PDFs, thumbnails, reading positions, and marks are stored in PostgreSQL and belong to your signed-in account. They are available when you sign in from another browser or device connected to the same app/database. Database backups include the PDF bytes and progress; browser storage is not used for books.

Choose one or more PDFs or drop them onto the import area. Each PDF must be unencrypted, no larger than **100 MB**, and contain 1–10,000 pages. The server validates the file before saving it. Re-importing an identical PDF into the same account preserves its existing title, reading position, and checkmarks. Different accounts may import their own copies independently. Removing a book removes its PDF, thumbnail, and marks, with a confirmation step.

Use **Previous page**, **Next page**, or the page-number form to navigate. Left/Right arrow keys turn pages when focus is outside a control; Escape returns to the library. Zoom controls and **Fit page width** support smaller screens. Turn on **Place checkmarks** and click/tap a spot on the page; click a saved checkmark to remove it. **Add checkmark at page center** provides a keyboard-accessible alternative. Page changes and marks save immediately. Concurrent edits use revision checks; failed updates reload saved progress before another attempt.

To move books from `/Users/aljaz/Desktop/Chess Books/index.html`, import the original PDF files here. That standalone reader remains unchanged. Its old browser-local reading position and checkmarks do not transfer automatically; navigate to the desired page and recreate marks in this reader. PDFs remain separate from manually authored learning exercises.

Existing installations must run `npx prisma migrate deploy` and `npm run db:generate`; the additive `20261002140000_books` migration creates only the book and mark tables. It has been applied to this workspace's local development database. PDF.js, its matching worker, compressed-image decoders (including JBIG2 and JPEG 2000), CMaps, and standard fonts are installed locally, so rendering requires no external CDN. These resources are required for image-based chess diagrams as well as text. Install/build/dev/start scripts prepare `public/pdfjs/` from the pinned dependency; deploy that generated public directory with the app. Proxy upload limits must permit the desired file size if you later host the app remotely.


## Learning library and chapter practice (TASK-035–036)

Open **Learning** in the header or `/learning`. Create a private material, add ordered chapters, and add numbered exercises. **Add Mate in One sample** creates the single exercise supplied in this conversation in the signed-in account: “The pin is mightier than the sword,” solved by `Rxa6#`. It is deduplicated and does not import the rest of the book or assign content to other accounts.

The exercise editor accepts a full FEN and offers piece placement/removal by board clicks or a keyboard square field. Set side to move, castling rights, and en-passant state explicitly. Enter SAN solution branches one per line, without PGN comments/results, and preview each branch before publication. Titles, source exercise numbers, ordering, printed diagram/answer pages, and an optional owned source PDF are stored separately. Downloading a linked source PDF uses the existing private endpoint; deleting that PDF does not delete the exercise. Missing Piece diagrams may be saved as incomplete drafts, but placement practice awaits TASK-037.

Choose **Save draft → Validate → Publish**. Mate objectives mean forced mate within at most 1–4 solver moves. The server checks all legal defenses with an exhaustive bounded search, discovers all accepted solver moves along the selected practice replies, and records the proof method. This is independent of Stockfish and AI providers. Validation has a **100,000-node / five-second / 1,024-practice-branch** limit; positions exceeding it remain drafts with feedback. A legal mating line alone does not prove forced mate. Authored tactical sequences are checked for legal transitions and their endpoint; legal moves outside their authored branches are labeled as outside the validated solution set rather than objectively losing. The book's published solution is retained separately from accepted practice alternatives.

Practice uses the existing board controls, precomputed automatic replies, hints/reveal, retry, previous/next, and chapter resume. At most four solver moves (seven half-moves) are supported by the learning solution format; existing personal-game puzzle versions and their three-move generation policy are preserved. The practice browser payload conceals solutions and explanations until reveal/completion. Revealing does not complete an exercise. Assistance, exact positions, first completions, and request/revision safeguards are persisted independently of PDF reading and personal-game puzzles.

Published answer revisions are immutable. Answer/prompt/help changes require new validation and publication, with fresh completion for the new revision. Earlier attempts/completions remain in **Exercise history**; an existing attempt can finish its pinned revision. Title/order/source-reference changes preserve answer identity and completion. Archives remove content from current navigation/totals and retain history. Current totals count published playable revisions; incomplete drafts are excluded.

Account owners author private material. Sharing curated material is an explicit local operator action:

```bash
npm run learning:admin -- share owner@example.com material-id
```

The command checks the selected owner and requires at least one published exercise. Shared material is read-only in the browser; each learner's progress remains private and source PDFs remain owner-only. There is no automatic sharing or browser endpoint for granting publication rights.

Apply `npx prisma migrate deploy` and `npm run db:generate` on other installations. The additive `20261003120000_learning` migration creates only learning tables; it does not rewrite games, puzzles, or books. Exercise entry is manual; automatic PDF diagram/solution extraction is outside the planned scope.


## Learning profile (TASK-038)

Open **Learning → Learning profile** (`/learning/profile`), also linked from **Account**. Answer the ten short questions about experience, optional rating and its platform/time control, goals, weaknesses, playing habits, study days/minutes, preferred activities, resources, and current focus. Unknown experience/rating and weaknesses are supported. Select at least one goal, weakness (or Not sure), activity, and study day. Each study day has its own integer budget of 5–240 minutes.

**Review answers** shows a weekly time summary and all answers before **Save learning profile**. Edit or cancel changes later; reload restores the saved profile. Resource options include owned PDFs and visible active learning materials; selecting a resource does not share it. Removed/archived resources retain their original titles in the saved summary and can be removed when editing. Saving checks resource visibility again on the server.

Profiles are private account data. Each accepted save creates an immutable input snapshot, allowing future plans to pin the exact answers and resource titles used. Concurrent edits are rejected with feedback; repeating the same save after a lost response returns the existing result. Weekly plan generation is available at `/learning/plan`; the profile screen itself makes no AI calls.

The additive `20261004100000_learning_profile` migration has been applied to this workspace's development database. Other installations should run `npx prisma migrate deploy` and `npm run db:generate`.


## Weekly learning plans (TASK-039)

Open **Learning → Weekly plan** (`/learning/plan`), also linked from the learning profile. Plans are reusable weekly templates, as confirmed by the user. Save a learning profile first, then explicitly choose **Generate weekly plan**. Generation uses the provider selected in **Settings**, its existing server API key, and the model configured in `lib/coaching/providers.ts`; it never silently switches providers.

The page states which provider/model will receive saved profile answers and resource titles before generation. One explicit request is bounded to **60 seconds**, **4,096 output tokens**, and **zero automatic provider retries**. Page loads and status polling make no paid calls. The catalog contains at most 100 options: owned PDFs, visible materials and chapters with published exercises, and saved-game/personal-puzzle libraries when nonempty. Preferred profile resources are prioritized. Exercise answers and PDF bytes are not sent to the provider. Unsupported/draft-only learning chapters are excluded.

A proposal contains sessions by weekday, activity, minute budget, and an optional catalog reference. Generic/offline sessions are clearly labeled and have fixed instructions; app resources link to their actual library/chapter. Generated display titles and instructions are neutral, and the provider cannot introduce URLs, resource descriptions, or promised rating gains. Both providers use structured output, with server checks for exact daily time totals, allowed weekdays, whole session lengths, known resources, and activity compatibility. [Official OpenAI Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs) informed the Responses implementation.

**Edit proposal** supports a custom title, day/minutes/activity/resource changes, and adding/removing sessions. Per-day totals remain visible. **Save proposal changes** persists the draft; **Accept weekly plan** separately makes it the current template. **Edit accepted plan** creates draft changes while preserving the accepted version until acceptance. Regeneration keeps the current accepted plan and prior proposal if the provider fails. Changed profiles are flagged; a plan retains the original profile version and finite content snapshot rather than adopting new answers silently.

Generation request IDs prevent duplicate paid requests after lost responses. A two-minute lease and fencing prevent late results from replacing a newer proposal, and an expired request can be replaced by an explicit new generation. Status refresh is read-only; it does not regenerate. Server ownership/origin checks, locked user rows, and revisions protect concurrent edits and acceptance. Deleted or newly private resources are rechecked before accepting/editing and shown as unavailable in existing templates. Accepted versions and their provider/model/inputs remain immutable for future weekly tracking; completion/skip/reschedule tracking is outside scope (TASK-040 was rejected).

The additive `20261004120000_weekly_plans` migration has been applied to the dedicated test and workspace development databases. Other installations should run `npx prisma migrate deploy` and `npm run db:generate`.

Run a separate, potentially paid live check with synthetic inputs and no database writes:

```bash
npm run test:plan -- OPENAI
# or explicitly choose the other provider:
npm run test:plan -- ANTHROPIC
```

Live acceptance on 2026-10-04: OpenAI succeeded in 4,026 ms using `gpt-5.4-mini-2026-03-17`, returning three valid sessions totaling the synthetic profile's 65-minute budget. Anthropic rejected its configured key; its adapter is covered by deterministic SDK and browser tests, but successful live Anthropic acceptance is not claimed. Update that key or select OpenAI in Settings to generate with the working configuration.

## Opening repertoire and practice (TASK-045)

Open **Openings** (`/openings`) from the sidebar, dashboard, or mobile account menu. Create a private opening with a name, description, and practice color. Use the normal starting position or apply a custom FEN. Changing the starting position clears the editor's variations; export them first if needed.

The editor plays both sides on the shared wooden board. Navigate an existing line, then make a different move to add a branch; extend a leaf to continue that variation. Rename/remove variations and explicitly **Save opening**. PGN import accepts SAN mainlines and nested branches, ignoring comments and NAGs. It adds unique move sequences; export produces one PGN game per authored line, including the custom FEN when needed. The initial limits are 100 variations and 160 plies per variation, with every branch checked for legality and terminal positions. Stale-tab saves preserve the editor and report a conflict rather than overwriting newer work.

**Practice variations** shuffles lines without repeats until the cycle ends. The user plays the opening's selected color; the opponent follows authored moves automatically after a one-second pause. Accepted user moves sound immediately, opponent replies sound when played, and a shared mute/unmute control is beside the board. During a pending reply the board and hints are locked; retry, reveal, or leaving the page cancels it. Opening study/editor/practice pages use a wider layout and larger responsive boards. A move from another saved branch is accepted and practice follows that branch. Illegal moves and legal moves outside the repertoire leave the board unchanged. Hints/reveal, retry, next variation, board flipping, square clicks, drag/drop, coordinate entry, and promotion are supported. Answers are hidden in the practice interface until hint/reveal/completion. These are the owner's own authored definitions, not server-concealed puzzle answers. Practice is session-only: no attempt history is saved, refresh restarts, and retry after assistance retains its assisted label. Deeper engine analysis remains TASK-047.

Related games match authored positions, including transpositions, with side to move, castling rights, and relevant en-passant state preserved; move counters are ignored. Matching uses positions after at least four plies from the normal start, or a custom starting position, within the first 40 plies. The overview shows the latest 50 matching owned games. Short normal-start variations can be practiced but do not match every imported game through its initial moves.

Upload private **MP4 videos up to 100 MiB each** on an opening's overview. Files stream to `.storage/opening-videos/` on the app server, outside `public/`; metadata lives in PostgreSQL. Authenticated playback supports byte ranges for seeking, and every upload/read/delete checks ownership. Browser codec support is required (the browser check uses an H.264 MP4). Removing a video removes its file and metadata. Back up this directory together with the database; restoring the database alone cannot restore videos. Storage must persist on the same server between runs. A crash during upload can leave an unreferenced `.upload` file; it is never served. Multi-server hosting and video transcoding are outside this local feature's scope.

The additive `20261006150000_openings` migration has been applied to the workspace development and dedicated test databases. Other installations should run `npx prisma migrate deploy` and `npm run db:generate` under Node 24.


## Position analysis

Open **Analysis** from navigation or dashboard quick access to explore legal moves for either side. Start from the normal board or load a six-field FEN under **Starting position**. Navigate the temporary line, play a different continuation from an earlier move, choose promotion pieces, flip the wooden board, or reset. Standalone variations are not saved.

Choose **Analyze position** to enable server-side Stockfish MultiPV analysis. Quick, Standard, and Deep presets use 1, 3, and 8 seconds of thinking time. The panel displays up to three ranked legal moves, SAN continuation lines (up to 24 half-moves), depth, a numerical score, and an evaluation bar. Scores always use White’s perspective: positive favors White, negative favors Black; `+M3` means White has a mate in three according to the search, and `−M3` means Black does. Bounds retain their ≥/≤ qualifier. Partial results update during search; final candidates come from one coherent depth, with fewer candidates when legal moves/search coverage are limited. These are finite search estimates.

Analysis updates automatically as the displayed position changes while enabled. **Stop analysis** cancels the current search and retains its partial results; **Disable analysis** prevents subsequent searches. Position changes immediately hide obsolete results, abort the old request/process, and debounce the new search. Engine failures preserve the explored line and offer retry. Checkmate, stalemate, insufficient material, and history-based draws are displayed without starting Stockfish.

The same controls appear beside the opening editor’s variation board and on the game review’s **Engine** tab. Review exploration has its own opt-in panel; saved evaluations/coaching stay separate. **Try** plays a candidate on standalone/exploration boards, or adds/selects an authored opening branch that requires the existing **Save opening** action. Active opening practice keeps suggestions concealed. Stockfish-play integration will reuse this panel when TASK-046 is implemented.

`POST /api/analysis` checks the session and request origin before reading a bounded 10 KB body. The payload is `{ startFen, moves, preset }`, with up to 400 legal UCI half-moves. Unknown fields and unsupported presets are rejected. The private, uncached NDJSON stream emits `progress`, `complete`, or sanitized `error` events. The engine receives the starting FEN and replayed move history to preserve repetition context. Each search runs in an isolated process with one thread and 16 MiB hash, a five-second initialization deadline, thinking-time-plus-five-second search timeout, and bounded stop/quit/kill cleanup. A process-local guard permits one position search per user and two simultaneous position searches per app process; it is intended for the current personal-server setup. No database migration or analysis persistence is added.

Run `npm run test:position-analysis` for a bounded live Stockfish check covering White/Black, three/one/two candidates, mate scores, legal continuations, progress, and cancellation. It reads `STOCKFISH_PATH` from the existing environment and makes no AI-provider calls.

## Millennium King Performance recording (experimental)

Open **My games → Record board game** to connect an M822 ChessLink through Web Bluetooth. Use desktop Chrome with Bluetooth enabled, on HTTPS or localhost, and close Chessconnect/other board clients. Keep the board in normal built-in King play for the first test; direct recording in that mode is not yet verified on physical hardware. If positions arrive only in CLink mode, this does not establish recording against the built-in King.

Choose your color, wait for **Synchronized**, then select **Start recording**. Incoming square order is calibrated automatically against the known position. Automatic recording is enabled by default and accepts completed legal moves after 800 ms. Confirmation mode remains available for troubleshooting; move the king first when castling. **Pause**, confirmed takebacks, and legal coordinate entry support reconciliation; reconnect/reload never guesses missing moves. Keep the tab active during play. Drafts are preserved locally for the signed-in account, with a visible warning if storage fails.

Use **Finish game**, confirm the result, then **Save to My Games** or **Download PGN**. Saving fixes the snapshot so retries cannot create duplicate games; failed saves preserve it. Review and analysis use the existing game workflow and wooden board assets. This feature does not retrieve games from the King's nine saved slots.

If connection or recording fails, **Download diagnostics** and record your board/ChessLink firmware, OS/browser, and whether the King was in normal play or CLink mode. See [protocol notes and real-board acceptance steps](lib/chesslink/README.md). Software checks use synthetic notifications and simulated BLE devices; real-board compatibility remains pending.

The recorder’s **Live board activity** panel shows timestamped position changes (including changed squares), square-order calibration, detected legal moves, confirmation/acceptance, and reasons for pausing. It also observes changes while recording is paused, without adding them to the game. Identical repeated positions are omitted; packet counts and the latest raw packet help distinguish no data from unchanged board data. **Clear activity** clears the display, and **Download activity and diagnostics** exports the latest 100 activity events plus the bounded transport log. Activity is local to the open page and is cleared by reload.

For a pressure board, pressing the departure square produces an incomplete position. Recording now stays active while that position fits a legal move in progress, even if it lasts longer than 800 ms. Click **Start recording** in the connection panel before playing. For automatic synchronization, enable **Automatically accept stable legal positions** before starting/resuming; confirmation mode instead requires confirming every completed move.

If you already played while paused, enter the complete SAN move sequence in **Moves already played** (for example, `1. d4 e6 2. e4 d5`) and click **Recover played moves**. Recovery validates legality, preserves the existing recorded prefix, and requires the final position to match a fresh board report. Then click **Resume recording**. This uses the sequence you supply and does not infer missing history from the final board.

King LED prompts: Listen only is enabled by default and sends no ChessLink commands. The user confirmed LEDs work with this mode on their board. Disabling it enables initial queries for troubleshooting and may interrupt the prompts.

## Play Stockfish (TASK-046)

Open **Play Stockfish** (`/play`) from the sidebar, mobile account menu, or dashboard. Choose White/Black and Easy, Casual, Challenging, or Strong, then start from the normal position or a valid six-field FEN. Settings apply when starting/restarting. The wooden ReplayBoard supports dragging, square clicks, coordinate entry, and all promotion choices. Stockfish plays the other side automatically; pause/resume, retry after failure, resignation, board flipping, and move sounds are available. Checkmate, stalemate, and chess.js draw outcomes end play. No clock is used.

Difficulty uses Stockfish Skill Level 0/5/10/20 with 250/500/1,000/2,000 ms per reply; these are not calibrated Elo ratings. Each server-side reply uses an isolated process, one thread, 16 MiB hash, a five-second initialization deadline, and a search deadline five seconds beyond its thinking budget. Full legal move history preserves repetition context. Requests require a session and the configured Origin, reject oversized/unknown payloads and wrong-turn positions, and share the existing per-user/two-process capacity guard with analysis. Pause, restart, resignation, leaving, and analysis assistance abort stale work; late responses cannot alter the new game. The initial limit is 400 half-moves.

**Show analysis assistance** pauses active play and exposes the shared opt-in top-three analysis panel. Close analysis to continue. Suggestions are concealed initially. Games remain temporary and refresh clears them. **Download PGN** preserves played moves, result, and custom starting position; import that file through My Games for private storage and review. Restart replaces the session, so download first. No new database migration or automatic saved-session history is added.

Run `npm run test:play` for bounded live Stockfish checks at every difficulty from normal/custom starts with both sides moving. It makes no AI-provider calls or database writes.

### Play Stockfish using the Millennium board

In `/play`, select **Move input → Millennium board (ChessLink)**. Put the King Performance in **CLink** mode, close other board clients, and use desktop Chrome on HTTPS or localhost. Choose your color/difficulty and starting FEN, connect ChessLink, arrange the physical pieces to match the screen, and start. Incoming square order is calibrated against the exact expected placement. Make your move physically; a completed legal placement is accepted after 800 ms, including slow departure/destination presses. Move the king first when castling; finish captures, rook movement, and promotion-piece replacement before continuing. Custom FENs work when the physical setup matches.

Stockfish's reply appears on screen as SAN and coordinates with board highlighting. **Execute that reply on the physical board**; the app waits for the exact resulting placement before accepting your next move. **Stockfish LED prompts** are enabled by default: changed squares blink until the physical board matches the engine target, including castling and en-passant changes. **Retry LED prompt** resends guidance; disabling prompts clears the app’s LEDs. Prompts clear on synchronization, pause, restart, resignation, and leaving physical input. Board-mode changes are still manual. Default connection initialization uses the existing V/S queries; **Skip initial queries** is an optional troubleshooting setting; it does not disable explicitly enabled LED prompts. **Query position** requests one fresh report when data is missing. Disconnects, hidden tabs, and unexpected stable positions pause play. Reconnect/query, restore the displayed position, and explicitly resume. Never reconstruct missing moves from a final placement. Switching back to on-screen input closes Bluetooth and pauses the game for explicit resumption.

Software verification uses simulated Bluetooth and legal engine responses. Physical King/ChessLink acceptance for Stockfish play remains to be checked on the user's hardware, especially notifications in CLink mode and special moves. PGN export and temporary-session behavior are shared with normal Stockfish play.

LED output uses the documented ChessLink `L`/`X` commands, the calibrated square order, XOR checksums and odd parity, and serialized 20-byte BLE packets. No brightness/EEPROM settings are changed. Bluetooth failures remain visible with reconnect/retry instructions. Simulation verifies exact frame content and clearing, but actual illumination still needs confirmation on the physical King/ChessLink. Protocol reference: [ChessLink LED specification](https://github.com/domschl/python-mchess/blob/master/mchess/magic-board.md).
