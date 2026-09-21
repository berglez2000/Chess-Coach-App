# Chess Coach App

A local chess-improvement application for importing PGNs, analyzing games with Stockfish, and reviewing them with AI coaching.

The application currently contains the initial home page, development tooling, and local PostgreSQL/Prisma setup. The PGN parsing service is also implemented; the three-control PGN import form is available at `/games/new`. Interactive board replay is also available. Imports now save games and moves transactionally in PostgreSQL; saved-game navigation, engine analysis, and coaching remain in the task backlog. V0.1 focuses on game review; puzzles, authentication, and deployment are deferred.

## Prerequisites

- Node.js **24 LTS, version 24.15.0 or later** (verified with 24.21.0), with npm 10 or later.
- If you use nvm, run `nvm install` and `nvm use` in this directory; `.nvmrc` selects Node 24.
- Confirm `node --version` prints `v24.x` before installing dependencies. The project declares Node 24 in `package.json` to keep development consistent.

Docker with Compose is required for database development (Docker Desktop or a running Colima engine on macOS). Stockfish and an OpenAI key are not needed yet. The initial home page and fast tests still work without a running database.

## Local development

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The server binds to the loopback interface for local use. Stop it with Ctrl+C. For a different port, run `npm run dev -- --port 3001`.

The home page needs no environment values. To enable database access, follow the setup below. Never commit local secrets or use a `NEXT_PUBLIC_` prefix for API keys.

## Local PostgreSQL and Prisma

1. Start Docker Desktop or your Colima engine.
2. If `.env.local` does not exist, copy `.env.example` to `.env.local`. Preserve any existing values.
3. Set `DATABASE_URL` to the local development connection string:

```dotenv
DATABASE_URL=postgresql://chess_coach:chess_coach_local@127.0.0.1:5433/chess_coach
```

These are disposable local-development credentials matching `compose.yaml`, not production credentials. PostgreSQL is published only on `127.0.0.1:5433`; the container uses port 5432. The named `postgres_data` volume stores the database under `/var/lib/postgresql`, as required by the PostgreSQL 18 image.

```bash
docker compose up -d --wait
docker compose ps
npm install
npx prisma validate
npx prisma migrate dev
npm run db:check
npm run dev
```

On this macOS setup, Compose is installed as **`docker-compose`**. If `docker compose` is unavailable, substitute `docker-compose` in these commands, for example `docker-compose up -d --wait`. Both read `compose.yaml`; no global Docker configuration change is required.

`npm install` / `npm ci` generates the Prisma client through `postinstall`. After changing the Prisma schema, run `npm run db:generate`. Generated files are ignored by Git. The schema now contains `Game` and `GameMove`. Run `npx prisma migrate dev` to apply checked-in migrations locally; use `npx prisma migrate dev --name <description>` when intentionally changing the schema. Regenerate the client afterward with `npm run db:generate`.

`npm run db:check` runs `SELECT 1` through the same server-only Prisma client used by future application services, prints a safe success/failure message, and disconnects. It never prints the connection URL. Its Node `react-server` condition allows the `server-only` marker in a server-side CLI; do not add that condition to browser or component-test commands.

### Environment loading

- Next.js loads environment files automatically; `DATABASE_URL` is accessed only by the server database module, which is protected by `import "server-only"`.
- Prisma CLI and `db:check` use `@next/env` to follow Next.js environment precedence: existing process variables, mode-specific local file, `.env.local` (except test mode), mode-specific file, then `.env`. The development mode is used unless `NODE_ENV=production` or `NODE_ENV=test` selects another mode.
- Prisma generation and schema validation require neither a connection URL nor a running database. If a nonempty URL is provided, it is validated. Actual database access always requires a valid PostgreSQL URL.
- Fast Vitest tests do not load local environment files and pass explicit configuration fixtures. They do not connect to the database. Integration tests use the dedicated service described below; they never load `.env.local`.
- Docker Compose uses the fixed development settings in `compose.yaml`; it does not receive `.env.local` or future OpenAI credentials. If you change database settings, keep Compose and `DATABASE_URL` consistent.

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

For repeatable installation from the lockfile, use `npm ci`.

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

Tests share the application's `@/` import alias. Use role-based DOM assertions for user-visible behavior and explicit fixtures or mocked adapters for future engine/AI tests. The fast suite requires no running app, database, Stockfish, API key, or paid requests. Integration tests have the separate command below; browser-suite tooling is deferred.

The initial tests cover the home-page heading and availability message, plus server-rendered home navigation and the skip link's target. They use the actual application components. jsdom does not verify responsive layout or browser navigation. Async Server Components will need integration/browser coverage when introduced.

The setup follows the [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest), [Vitest environment documentation](https://vitest.dev/guide/environment.html), and [React Testing Library setup guide](https://testing-library.com/docs/react-testing-library/setup/).

## Database models and integration tests

`Game` stores the original PGN, explicit initial FEN, optional metadata, required user color, analysis status/error, and timestamps. `GameMove` stores canonical 1-based plies, actual move numbers, SAN/UCI, side, and before/after FENs. Player names remain nullable when PGN headers are absent. Played dates use PostgreSQL DATE; raw dates remain preserved in the PGN. No engine results, annotations, user, or puzzle models are included yet.

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

Open the home page and choose **Import a game**, or visit `/games/new`. Select White or Black, paste one PGN, and click **Import**. The server validates both fields with Zod, parses the PGN, saves the game and all moves atomically with PENDING status, and returns the saved ID with normalized positions and the selected user color. Client-supplied positions are ignored.

The form has only three controls. Browser validation checks required fields, whitespace gets immediate feedback, and the server repeats validation independently. Inputs are retained after validation/connection errors and disabled during a pending submission. Single-game PGNs are limited to 100,000 characters.

A successful import opens a game review below the form, with metadata, a chessboard, a clickable move list, and Start/Previous/Next/End controls. The board defaults to your selected color and pieces cannot be dragged. The layout places the move list beside the board on wider screens and below it on narrow screens.

The game and its moves are **saved in PostgreSQL**. Refreshing clears the current replay view; the library and URLs for reopening saved games arrive in TASK-009. Editing the import fields hides the previous review; a new import starts at the initial position. Identical PGNs may be saved as separate games. No Stockfish or OpenAI requests are made at this stage.

`POST /api/games` accepts JSON `{ "userColor": "WHITE", "pgn": "1. e4 e5 *" }` (or BLACK). Success returns HTTP 201 with `{ gameId, status: "PENDING", userColor, game }`; `game` contains the server-parsed replay DTO to preserve the immediate review until saved-game navigation is implemented. Errors use `{ error: { code, message, fields? } }`: malformed JSON, invalid fields, and PGN errors return 400; unexpected parsing/storage failures return 500 with a sanitized message. Validation runs before database access. The import service accepts a repository interface, and the Prisma implementation saves the parent and all moves in one nested-write transaction. Integration tests exercise real storage, invalid input, duplicate-PGN imports, constraint-triggered rollback, and retry.

### Replay position convention

`GameReview` owns one `selectedPly` state. Ply 0 shows `initialFen`, including SetUp/FEN positions. Selecting ply N shows that move's `fenAfter`, highlights the same move in the list, and updates the progress label. Previous/Next traverse half-moves; Start/End jump to the boundaries. Labels use the parsed full-move number and side, so a Black-to-move game starting at move 23 displays `23...`, not `1.`. A missing White move is shown as a dash in its column.

Future evaluation and coaching panels must use this same selected ply. Comparisons must label before/after evaluations explicitly, and a better alternative begins from the selected move's `fenBefore`, not the displayed resulting position. Board flip and keyboard navigation remain later review-polish tasks.

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
