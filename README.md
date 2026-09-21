# Chess Coach App

A local chess-improvement application for importing PGNs, analyzing games with Stockfish, and reviewing them with AI coaching.

The application currently contains the initial home page, development tooling, and local PostgreSQL/Prisma setup. Import, review, engine, and coaching functionality will be added through the task backlog. V0.1 focuses on game review; puzzles, authentication, and deployment are deferred.

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
npm run db:check
npm run dev
```

On this macOS setup, Compose is installed as **`docker-compose`**. If `docker compose` is unavailable, substitute `docker-compose` in these commands, for example `docker-compose up -d --wait`. Both read `compose.yaml`; no global Docker configuration change is required.

`npm install` / `npm ci` generates the Prisma client through `postinstall`. After changing the Prisma schema, run `npm run db:generate`. Generated files are ignored by Git. The schema deliberately has no models or migrations yet; TASK-007 introduces the first product migration. Do not run migrations or create a dummy table for this bootstrap.

`npm run db:check` runs `SELECT 1` through the same server-only Prisma client used by future application services, prints a safe success/failure message, and disconnects. It never prints the connection URL. Its Node `react-server` condition allows the `server-only` marker in a server-side CLI; do not add that condition to browser or component-test commands.

### Environment loading

- Next.js loads environment files automatically; `DATABASE_URL` is accessed only by the server database module, which is protected by `import "server-only"`.
- Prisma CLI and `db:check` use `@next/env` to follow Next.js environment precedence: existing process variables, mode-specific local file, `.env.local` (except test mode), mode-specific file, then `.env`. The development mode is used unless `NODE_ENV=production` or `NODE_ENV=test` selects another mode.
- Prisma generation and schema validation require neither a connection URL nor a running database. If a nonempty URL is provided, it is validated. Actual database access always requires a valid PostgreSQL URL.
- Fast Vitest tests do not load local environment files and pass explicit configuration fixtures. They do not connect to the database. Future integration tests must use a separate test database; that setup belongs to TASK-007.
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

Tests share the application's `@/` import alias. Use role-based DOM assertions for user-visible behavior and explicit fixtures or mocked adapters for future engine/AI tests. The fast suite requires no running app, database, Stockfish, API key, or paid requests. Integration and browser suites will have separate commands in later tasks.

The initial tests cover the home-page heading and availability message, plus server-rendered home navigation and the skip link's target. They use the actual application components. jsdom does not verify responsive layout or browser navigation. Async Server Components will need integration/browser coverage when introduced.

The setup follows the [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest), [Vitest environment documentation](https://vitest.dev/guide/environment.html), and [React Testing Library setup guide](https://testing-library.com/docs/react-testing-library/setup/).

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
