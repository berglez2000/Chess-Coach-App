# V0.1 release acceptance — TASK-026

Status: **BLOCKED**, verified 2026-09-28. Setup documentation and available checks are complete; this is not a claim that V0.1 meets every requirement.

## TASK-027 follow-up

Dual-provider implementation resolves the provider/specification mismatch: the approved specification now allows Anthropic (Claude) and OpenAI (GPT), selected in persistent app settings. Both use shared validation, atomic replacement, provider/model attribution, and bounded requests. The previously documented timeout/lease mismatch is resolved with 120-second SDK timeouts, zero automatic retries, and a 150-second application deadline within the five-minute lease. Legacy content/model migration and failed-regeneration preservation have automated coverage.

Both keys are still absent (presence checked without printing values). Live Anthropic and OpenAI checks, their durations, and complete real-service quality remain **blocked** under TASK-026. The default Turbopack build limitation is unchanged. TASK-027 verification details are recorded in TASKS.md; the original TASK-026 evidence below remains a historical record.

## Original TASK-026 outstanding acceptance

- Neither `ANTHROPIC_API_KEY` nor `OPENAI_API_KEY` is configured in the process/local environment. Only presence was inspected, never values. Live coaching, live coaching duration, and the complete real-service loop remain **blocked**; automated coaching uses explicit fixtures and made no paid requests.
- The specification requires OpenAI, but `lib/coaching/ai-client.ts` implements Anthropic with `claude-haiku-4-5`. The environment template now describes the actual adapter. A provider migration or an explicit specification decision is required before claiming the OpenAI definition-of-done item. This release-documentation task does not silently change that requirement or migrate providers.
- Plain `npm run build` still fails in this environment when Turbopack's CSS worker binds a port (`Operation not permitted`), including outside the filesystem sandbox. `npm run build -- --webpack` passes. The default-build verification remains failed; the documented fallback is usable.

## Environment and commands

macOS 26.3.1 arm64, Node 24.21.0, npm 10.8.2, PostgreSQL 18 in Colima with standalone `docker-compose`, official Stockfish 19 macOS universal binary. The binary was reused from a temporary installation outside the repository; users must configure their own durable path. No package versions or engine/AI implementations changed.

| Check | Result |
| --- | --- |
| `npm ci --offline` | Passed from lockfile and local cache, including Prisma generation; initial sandbox attempt could not update the Prisma cache, so installation was rerun with filesystem access. Online registry installation from an empty package cache was not tested. |
| Fresh database | Created unused `task026_release` in the separate test PostgreSQL process on port 5434. Applied all four migrations with the normal Prisma config; `prisma validate`, `migrate deploy`, and `db:check` passed. No reset, development-volume removal, or development data mutation. |
| Documented startup | `npm run dev -- --webpack --port 3002` with the isolated URL exported; actual Chromium imports and saved reviews passed. Server restart and library reopening passed for both colors. |
| `npm run lint` | Passed, zero warnings. |
| `npm run typecheck` | Passed. |
| `npm test` | 26 files, 302 tests passed. |
| `npm run test:integration` | 6 files, 36 tests passed in the fixed isolated test database. |
| `npm run test:e2e` | Both Chromium journeys passed: White desktop and Black mobile, deterministic engine/coaching. |
| `npm run test:engine` | Real depth-12 search returned legal `e2e4`, +32 cp from White's perspective, legal PV, and clean process shutdown. |
| `npm run build` | Failed: existing Turbopack worker-port restriction. |
| `npm run build -- --webpack` | Passed production compilation, TypeScript, page generation, and route output. |
| Live coaching | BLOCKED: no credentials; no live provider response was claimed. |
| `npm audit --json` | Four high-severity entries remain in Prisma/config, deepmerge-ts, and mysql2; no critical entries. The online audit supersedes the offline install's zero-advisory output. No forced downgrade applied. |

Temporary verification scripts and outputs stayed outside source control. The fresh release database was removed after verification; the pre-existing test service remains available. Only this task's database was removed. Integration and browser runners cleaned their own fixture records.

## Measured duration

The non-sensitive [demo PGN](../samples/demo.pgn) uses fictional labels over the public-domain Opera Game moves. It has 33 plies and finishes with `17. Rd8#`. An ad hoc Chromium check parsed it, imported both colors through the real form, asserted all 33 saved assessments, verified the actual rendered final piece placement, refreshed, and reopened the reviews after restarting the server.

With real Stockfish 19 at depth 12, one thread, 16 MB hash, MultiPV 1, default 30-second per-search timeout, and no move-time override:

| Selected color | Import click through analysis HTTP response | Analyze route duration from server log |
| --- | --- | --- |
| White | 6.53 seconds | 6.1 seconds |
| Black | 6.22 seconds | 5.9 seconds |

These are two warm-development-server samples, including database writes and the immediate missing-key coaching result. They are **not** live-coaching latency or a representative full rapid-game benchmark. A preceding cold-compilation check completed engine analysis but its temporary verifier read the wrong nested DTO field; that verifier was corrected and both runs above passed. No product change was needed. Longer games, larger search budgets, hardware, and concurrent games change duration. The HTTP request remains synchronous.

## Definition-of-done audit

Each row maps to specification section 24. Historical evidence refers to the detailed notes in [TASKS.md](../TASKS.md); current automated checks were rerun for this task.

| Requirement | Evidence / status |
| --- | --- |
| Start the documented stack locally | Fresh database, all migrations, database check, webpack dev server, actual browser workflow; default Turbopack build limitation above. |
| Select White/Black and paste PGN | Both current E2E journeys and real demo imports. Form remains exactly three controls. |
| Validate/save color; use orientation and coaching perspective | Import unit/integration tests, prompt/selector tests, both E2E and real-demo orientations. Live coaching quality remains blocked. |
| Useful invalid-PGN error | Parser/import tests and both E2E illegal-move submissions with retained input. |
| Store imported game in PostgreSQL | Fresh-database imports, saved detail reads, integration persistence/rollback tests. |
| Replay all moves correctly | Real-board component tests traverse every fixture ply; E2E selects actual rendered positions; demo check confirms terminal board. |
| Generate/store consistent Stockfish results | Real engine smoke, both demo games with 33 persisted rows, evaluation/mate/protocol unit tests and orchestration integration tests. |
| Highlight important moves without routine annotations | Selection tests, coaching-display tests, positive/no-positive fixtures, E2E annotated and ordinary selections. |
| OpenAI produces validated grounded explanations | **BLOCKED**: existing Anthropic implementation and no live credentials. Prompt, schema, semantic cross-check, persistence, and deterministic browser coverage pass; mocks are not live evidence. |
| Useful review after AI failure | Both real demos retain engine results with MISSING_KEY; E2E failure followed by AI-only retry verifies unchanged engine rows and no duplicate annotations. |
| Navigate summary and critical moments | Both E2E journeys synchronize board, engine facts, and coaching at direct/critical/summary selection. |
| Refresh/restart preserves games | Current browser reloads and application restart/reopen; TASK-003 verified development-volume persistence across container recreation, TASK-009 recorded saved-game restart checks. Test-service tmpfs is intentionally disposable. |
| Secrets server-side and out of source control | `.env.local` ignored; only names in `.env.example`; database, engine, and provider entry points import `server-only`. Tracked-file scan found no provider/GitHub key patterns or private-key headers. No secret values were printed. This limited scan is not a full Git-history security audit. |
| Core behavior tested | 302 fast tests, 36 integration tests, 2 E2E journeys and real-engine smoke pass. |
| README works on clean local environment | Fresh database and lockfile reinstall/startup verified on the supported existing macOS toolchain; not a fresh OS or empty dependency cache. Live coaching and default build exceptions are explicit. |
| No V0.2-only prerequisite | Routes/schema/import flow inspected: no authentication, deployment, puzzles, training, or weakness-statistics prerequisite. |

## Remaining limitations and cleanup audit

- Removed obsolete README claims about temporary import, missing persistence/analysis, deferred browser tooling, and future keyboard/flip support. Source inspection found no remaining temporary import server action or unsaved preview path to delete; imports use the persisted API. No speculative source cleanup was necessary.
- Coaching SDK defaults allow a ten-minute request timeout with two retries, while coaching ownership expires after five minutes and is not renewed during the provider request. A slow live request can outlast ownership and its save will be rejected. This existing risk needs real-service verification and a separately scoped timeout/lease decision; no latency guarantee is made here.
- Local synchronous execution has no aggregate engine concurrency cap. Each FEN launches a process and lacks historical repetition context. Classification is heuristic; positive highlights are intentionally limited and can be absent.
- Structured validation checks shape, allowed plies, and engine classifications; it cannot prove every natural-language explanation is factually grounded. Live review quality is unverified.
- Only Chromium desktop/mobile and macOS arm64 received current browser/engine checks. No hosted deployment, Windows/Linux setup, load, or long-game performance acceptance is claimed.
- Existing dependency advisories remain as noted above. No real keys, engine binaries, generated files, temporary scripts, or personal games were added.

To unblock release acceptance, resolve the provider/specification mismatch, configure the chosen provider locally, execute the README's live-coaching and retry walkthrough for both colors, record duration and persisted validated output, and resolve or explicitly accept the default-build environment limitation. Keep TASK-026 BLOCKED until required evidence exists.
