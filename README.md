# Chess Coach App

A local chess-improvement application for importing PGNs, analyzing games with Stockfish, and reviewing them with AI coaching.

The application currently contains the initial home page and development tooling. Import, review, database, engine, and coaching functionality will be added through the task backlog. V0.1 focuses on game review; puzzles, authentication, and deployment are deferred.

## Prerequisites

- Node.js **24 LTS, version 24.15.0 or later** (verified with 24.21.0), with npm 10 or later.
- If you use nvm, run `nvm install` and `nvm use` in this directory; `.nvmrc` selects Node 24.
- Confirm `node --version` prints `v24.x` before installing dependencies. The project declares Node 24 in `package.json` to keep development consistent.

PostgreSQL, Docker, Stockfish, and an OpenAI key are not needed for this initial home page.

## Local development

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The server binds to the loopback interface for local use. Stop it with Ctrl+C. For a different port, run `npm run dev -- --port 3001`.

No environment values are required yet. `.env.example` lists the planned variable names with blank values. When integrations are introduced, copy it to `.env.local` and fill in the documented values. Never commit local secrets or use a `NEXT_PUBLIC_` prefix for API keys.

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
- System fonts keep the initial page and build independent of external font downloads.

Setup follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs). Node 24 is an LTS release listed in the [Node.js release schedule](https://nodejs.org/en/about/previous-releases).

## Project documents

- [Product and technical specification](CHESS_COACH_V0.1_SPEC.md)
- [Development tasks](TASKS.md)
