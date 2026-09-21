# Chess Coach — V0.1 Product and Technical Specification

## 1. Purpose of this document

This document is the source of truth for building Chess Coach V0.1. It is written for both the developer and coding agents such as Codex.

Before implementing a task, read this document, inspect the current repository, and read `TASKS.md` if it exists. Implement only the requested task. Do not silently expand the product scope.

## 2. Product vision

Chess Coach is a personal chess-improvement application that turns the user's own online games into permanent, reusable training material.

The core problem is not a lack of chess analysis tools. Lichess, Chess.com, and Stockfish can already show engine evaluations. The problem is that a player often reviews a game once, sees a few mistakes, and then forgets the lessons.

The long-term product vision combines the following; puzzles and weakness statistics are deferred beyond V0.1:

- objective analysis from Stockfish;
- clear, level-appropriate explanations from an AI coach;
- an interactive move-by-move game review;
- puzzles generated from mistakes in the user's own games;
- structured data that can later reveal recurring weaknesses.

The initial user is Aljaž, an improving club-level player currently around 1400 Lichess rapid. The explanations should be practical and educational. They should explain patterns and decisions rather than merely repeat engine evaluations.

## 3. Version strategy

### V0.1 — local MVP

V0.1 focuses on importing, analyzing, and reviewing games. It runs locally on one computer, with no authentication or deployment. Puzzles, training, and recurring-weakness statistics are outside V0.1.

Its essential loop is:

1. Select your color (White or Black) and paste a PGN into the app.
2. Validate and parse the PGN.
3. Store the game locally.
4. Analyze it with Stockfish.
5. Select important moments.
6. Ask the OpenAI API for structured coaching explanations.
7. Validate the AI response.
8. Save the complete analysis.
9. Review the game on an interactive chessboard.

Everything except the OpenAI API runs locally. The OpenAI API key is stored in a local environment file and is never sent to the browser.

### V0.2 — deployed application

V0.2 will add:

- deployment;
- authentication;
- users and game ownership;
- production security and operational concerns.

The V0.1 schema should be reasonably easy to extend with a `User` model, but V0.1 must not implement unused authentication abstractions.

### Later possibilities

These are ideas, not V0.1 requirements:

- puzzles generated from personal mistakes and interactive training;
- automatic Lichess or Chess.com imports;
- spaced repetition;
- recurring-weakness statistics;
- personalized daily training plans;
- opening statistics and repertoire tools;
- progress tracking;
- richer puzzle scheduling;
- multiple users and social functionality.

## 4. V0.1 scope

### Required

- Local Next.js application.
- Import form with a required White/Black color selector, PGN textarea, and submit button.
- PGN validation and parsing, with server-side validation of the selected color.
- Local PostgreSQL database.
- Game library/list.
- Interactive game-review screen.
- Move navigation with Previous, Next, and direct move selection.
- Stockfish analysis with evaluations, best moves, and principal variations.
- Identification and classification of critical moves.
- OpenAI structured output for summaries, explanations, lessons, and categories.
- Runtime validation of AI output before persistence.
- Display of critical moments beside the correct board position.
- Useful loading, success, empty, and error states.
- A testable service layer for PGN, engine, AI, and persistence logic.

### Explicit non-goals

- Puzzle generation, puzzle solving, and training screens.
- Recurring-weakness statistics and weakness counts.
- Authentication or registration.
- Deployment or cloud infrastructure.
- Multiple-user UI.
- Automatic account synchronization.
- Live chess.
- Social features, comments, sharing, leaderboards, or achievements.
- Payments.
- Opening explorer or repertoire builder.
- Native mobile app.
- A general-purpose AI chat interface.
- Exhaustive annotation of every move.
- Pixel-perfect analytics dashboards before the core loop works.

## 5. Product principles

1. **Educational value over engine noise.** Most ordinary moves need no commentary. Highlight roughly 5–10 meaningful moments in a normal game.
2. **Stockfish establishes chess facts.** The language model explains those facts; it must not invent objective evaluations.
3. **The application owns the contract.** AI output must conform to a versioned, validated schema.
4. **The app works without AI.** If the OpenAI request fails, engine analysis should remain viewable and retryable.
5. **Personal mistakes become lessons.** Reviews should preserve game context and teach transferable ideas. Turning those mistakes into puzzles is a future extension.
6. **Build vertical slices.** Every milestone should leave a demonstrably working application.
7. **Local-first simplicity.** Avoid queues, microservices, Redis, Kubernetes, and production infrastructure in V0.1.

## 6. Recommended technology stack

| Area | Technology | Responsibility |
|---|---|---|
| Application | Next.js, App Router, TypeScript | UI and server endpoints/actions |
| Styling | Tailwind CSS | Responsive UI styling |
| Board | `react-chessboard` | Chessboard rendering and interaction |
| Chess rules | `chess.js` | PGN, SAN, FEN, legal moves, game state |
| Database | PostgreSQL in Docker | Local persistent storage |
| ORM | Prisma | Schema, migrations, typed queries |
| Engine | Stockfish | Objective position analysis |
| AI | OpenAI API | Coaching summaries and explanations |
| Validation | Zod | Requests, application DTOs, AI output |
| Testing | Vitest and React Testing Library | Unit/component tests |
| E2E testing | Playwright, when useful | Critical user flows |
| Package manager | npm unless repository says otherwise | Dependency management |

Use current stable, mutually compatible package versions at implementation time. Commit the lockfile. Do not expose server-only dependencies or secrets to client bundles.

## 7. High-level architecture

```text
Browser
  |
  v
Next.js on localhost
  |-- PGN parser (chess.js)
  |-- application services
  |-- Prisma --> PostgreSQL in Docker
  |-- Stockfish adapter --> local engine process
  `-- OpenAI adapter --> OpenAI API
```

The browser talks only to the local Next.js application. It must never call OpenAI directly.

Recommended dependency direction:

```text
UI / routes
    v
application services
    v
domain types and rules
    v
adapters: Prisma, Stockfish, OpenAI
```

Keep domain data independent from library-specific response objects. Convert Stockfish, Prisma, and OpenAI results at adapter boundaries.

## 8. Main user journeys

### 8.1 Import and analyze a game

1. User opens `/games/new`.
2. User selects their color (White or Black), pastes a PGN, and submits the form.
3. Client provides immediate basic feedback, but the server performs authoritative validation of both PGN and selected color.
4. Server parses headers and all moves using `chess.js`.
5. Server derives `fenBefore` and `fenAfter` for every ply.
6. Game, selected user color, and moves are saved.
7. Analysis status changes from `PENDING` to `ENGINE_RUNNING`.
8. Stockfish analyzes the game.
9. Engine results are saved incrementally or transactionally.
10. Critical positions are selected.
11. Status changes to `AI_RUNNING`.
12. One structured OpenAI request is sent for the game, rather than one request per move.
13. The response is validated with Zod and cross-checked against known plies.
14. Valid annotations and the game summary are saved.
15. Status becomes `COMPLETED`.
16. User is redirected to `/games/{id}`.

If engine or AI analysis fails, the game remains saved and the UI offers a retry. Never discard the imported game merely because analysis failed.

### 8.2 Review a game

The review page shows:

- players, colors, result, date, opening, and time control when available;
- chessboard at the currently selected ply;
- move list;
- Previous, Next, Start, and End controls;
- current move number and total moves;
- engine evaluation for analyzed positions;
- annotation for the selected critical move;
- better move and principal variation when available;
- game summary and a clickable list of critical moments.

Clicking a move or critical moment must update the board and annotation together. Board orientation defaults to the user's color selected during import, with a manual flip control. The selected color also identifies the user's moves for critical-moment selection and coaching; no username inference is needed.

## 9. Screens and routes

### `/`

A small dashboard or useful home screen linking to Import Game and My Games. V0.1 may show a game count and recent games. Weakness statistics and training metrics are deferred.

### `/games/new`

The form has three controls:

- Required color selector: White or Black (the side the user played).
- PGN textarea with an example/placeholder format.
- Import and Analyze submit button.

Supporting feedback:

- Validation errors that are specific and readable.
- Progress state during analysis.
- No API keys in the form.

### `/games`

- List of stored games, newest first.
- Player names, result, date, opening, analysis status.
- Link to each review.
- Empty state linking to import.

### `/games/[id]`

- Metadata header.
- Board and controls.
- Scrollable/clickable move list.
- Evaluation and critical-moment markers.
- AI explanation panel.
- Game summary.
- Retry analysis action when failed or incomplete.

## 10. Suggested project organization

The exact layout may follow current Next.js conventions. A reasonable starting point is:

```text
app/
  api/
    games/
    games/[id]/
    games/[id]/analyze/
  games/
    new/
    [id]/
components/
  chess/
  games/
  analysis/
lib/
  db/
  pgn/
  engine/
  ai/
  analysis/
  validation/
prisma/
  schema.prisma
types/
tests/
TASKS.md
README.md
```

Avoid giant route files. Put parsing, classification, and prompt construction in independently testable modules.

## 11. Domain model

The final Prisma design may adapt to implementation constraints, but it should represent these concepts.

### Game

- `id`
- raw `pgn`
- `whiteName`
- `blackName`
- `result`
- `playedAt` nullable
- `event` nullable
- `site` nullable
- `round` nullable
- `openingName` nullable
- `eco` nullable
- `timeControl` nullable
- `userColor` required (`WHITE` or `BLACK`), explicitly selected during import
- `analysisStatus`
- `analysisError` nullable
- `summary` nullable
- `strengths` structured JSON or related records
- `improvements` structured JSON or related records
- timestamps

Suggested analysis statuses:

- `PENDING`
- `ENGINE_RUNNING`
- `ENGINE_COMPLETED`
- `AI_RUNNING`
- `COMPLETED`
- `FAILED`

### GameMove

- `id`
- `gameId`
- `ply` (1-based half-move index)
- `moveNumber`
- `color`
- `san`
- `uci`
- `fenBefore`
- `fenAfter`
- `evaluationBeforeCp` nullable
- `evaluationAfterCp` nullable
- mate values where applicable
- `bestMoveUci` nullable
- `bestMoveSan` nullable
- `principalVariation` JSON nullable
- `centipawnLoss` nullable
- `classification` nullable
- timestamps if needed

`ply` is the canonical identifier for a move inside a game. Be careful about the difference between full move number and ply.

### MoveAnnotation

- `id`
- `gameMoveId` unique for V0.1 unless multiple annotation types are needed
- `headline` nullable
- `explanation`
- `lesson`
- `category`
- `model` nullable
- `schemaVersion`
- timestamps

### Future user readiness

Do not implement authentication in V0.1. A future migration may add `User` and `userId` to games. Prefer a schema that can accommodate that without redesigning every relation, but do not add fake login behavior.

## 12. PGN parsing requirements

The PGN parser must:

- accept standard PGN headers and movetext;
- support games without all optional headers;
- return a clear error for malformed or illegal PGN;
- preserve the original PGN;
- extract available metadata;
- produce all half-moves in order;
- derive SAN, UCI, color, move number, `fenBefore`, and `fenAfter`;
- recognize normal endings, checkmate, resignation, draw, and unfinished `*` where supported;
- avoid trusting client-derived positions.

Add unit-test fixtures for:

- a normal complete game;
- castling;
- promotion;
- en passant;
- check and checkmate SAN;
- comments and variations in PGN if supported by the chosen parser;
- invalid PGN.

## 13. Stockfish analysis pipeline

### Role

Stockfish determines objective chess information:

- evaluation before and after a move;
- best move;
- one short principal variation;
- mate indications;
- approximate evaluation loss;
- candidate critical positions.

### Engine execution

Use a server-side adapter around the UCI protocol. Keep process management out of route handlers. The adapter should support:

- initialization and readiness checks;
- position setup from FEN;
- bounded analysis by depth or time;
- parsing `info` lines;
- returning a normalized typed result;
- graceful shutdown;
- timeouts and useful errors.

Choose conservative local defaults so a normal rapid game completes in reasonable time. Make depth or move time configurable through non-secret environment variables.

### Evaluation perspective

Normalize evaluations consistently, preferably from White's perspective in storage. When calculating the quality of a played move, convert the difference to the moving player's perspective. Document this carefully and test it; sign mistakes here would invalidate classifications.

Mate evaluations must not be treated as ordinary centipawn numbers. Preserve mate distance separately and define comparison logic.

### Critical-move classification

Initial heuristic thresholds may be approximately:

| Evaluation loss | Classification |
|---:|---|
| under 20 cp | normal |
| 20–49 cp | inaccuracy |
| 50–99 cp | mistake |
| 100+ cp | blunder |

These are starting values, not absolute chess truth. Add safeguards:

- avoid labeling forced or nearly equivalent moves harshly;
- handle mate gained or lost explicitly;
- consider reducing misleading classifications in already overwhelming positions;
- never call a move brilliant solely from centipawn loss;
- positive highlights can initially be based on finding a difficult best/near-best move, tactical swing, or AI-selected instructional value.

Persist raw engine facts so classification logic can improve later without rerunning the engine.

### Selecting moments for AI

Do not send all moves for detailed annotation. Select approximately 5–10 moments using signals such as:

- largest evaluation losses by the user;
- a missed tactic or threat;
- a strong move by the user;
- a major change in game state;
- a useful opening/development lesson;
- a meaningful conversion or endgame decision.

Avoid several near-duplicate moments from the same tactical sequence.

## 14. OpenAI coaching pipeline

### Security

- Store `OPENAI_API_KEY` in `.env.local`.
- Never prefix it with `NEXT_PUBLIC_`.
- Never return it in API responses or logs.
- Commit an `.env.example` containing names only, never real values.
- Ensure `.env.local` is ignored by Git.

### Input to the model

One game-level request should contain:

- player color and approximate rating;
- PGN or sufficient game context;
- game result and metadata;
- selected critical positions;
- played move;
- engine evaluations before and after;
- best move and short principal variation;
- relevant FEN;
- desired coaching tone and output schema.

The prompt must tell the model:

- Stockfish data is authoritative;
- do not invent alternate moves not supported by the supplied data unless explicitly allowed;
- explain the idea in language suitable for an improving ~1400 Lichess rapid player;
- distinguish tactical, strategic, opening, calculation, endgame, and practical lessons;
- be concise enough for a review panel;
- focus on transferable lessons, not memorizing one engine move;
- output only the required structured format.

### Structured output contract

A conceptual response shape:

```json
{
  "schemaVersion": 1,
  "summary": "You handled the opening well but attacked before finishing development.",
  "strengths": ["Central control", "Tactical awareness"],
  "improvements": ["Complete development", "Check opponent threats"],
  "criticalMoments": [
    {
      "ply": 35,
      "classification": "mistake",
      "headline": "Premature queen attack",
      "explanation": "Qf3 placed the queen where Black could gain time attacking it while your queenside pieces were undeveloped.",
      "lesson": "Finish development before committing the queen unless a concrete tactic justifies it.",
      "category": "development"
    }
  ]
}
```

Use the OpenAI SDK's supported structured-output mechanism where practical, plus Zod validation in application code.

### Validation and cross-checking

Before saving:

- validate the schema;
- reject unknown or duplicate plies;
- ensure referenced plies exist in this game;
- ensure classifications and categories are allowed values;
- enforce reasonable string and array limits;
- do not allow the model to overwrite engine facts;
- record a safe, useful error for retry if validation fails.

### Suggested categories

- `tactics.fork`
- `tactics.pin`
- `tactics.skewer`
- `tactics.discovered_attack`
- `tactics.removing_defender`
- `tactics.hanging_piece`
- `strategy.weak_square`
- `strategy.bad_piece`
- `strategy.pawn_structure`
- `strategy.space`
- `opening.theory`
- `opening.development`
- `opening.king_safety`
- `opening.premature_attack`
- `calculation.missed_threat`
- `calculation.candidate_moves`
- `calculation.depth`
- `endgame.king_activity`
- `endgame.pawn_ending`
- `endgame.rook_ending`
- `endgame.conversion`
- `practical.time_management`
- `practical.blunder_check`
- `practical.simplification`
- `other`

Use a centralized enum or controlled mapping, not arbitrary strings throughout the codebase.

## 15. API contracts

Routes may use REST handlers or well-defined server actions. Keep stable DTOs and validate every boundary.

### `POST /api/games`

Purpose: validate/import a PGN and create the initial game records.

Request:

```json
{ "userColor": "WHITE", "pgn": "[Event ...]" }
```

Successful response:

```json
{
  "gameId": "...",
  "status": "PENDING"
}
```

`userColor` is required and must be `WHITE` or `BLACK`. Invalid or missing color, or invalid PGN, returns `400` with a safe field-level or general error. Unexpected failures return a stable error envelope without leaking secrets or stack traces.

### `POST /api/games/{id}/analyze`

Purpose: run or retry the analysis pipeline.

For V0.1 it may run synchronously if performance is acceptable. If the HTTP request becomes unreliable, use a local asynchronous mechanism without introducing production-grade infrastructure. Prevent duplicate simultaneous runs for the same game.

### `GET /api/games`

Returns a summarized game list.

### `GET /api/games/{id}`

Returns metadata (including selected user color), moves, engine results, annotations, and summary required for review.

## 16. Deferred puzzle direction (after V0.1)

This section preserves future design guidance only. Do not implement puzzle models, APIs, generation, training UI, or attempts in V0.1.

A game mistake is not automatically a good puzzle. Generate a puzzle only when:

- there is a clear, legal best continuation;
- the move is instructional;
- the best line is stable enough at the configured engine depth;
- the solution is not excessively long for the initial puzzle release;
- the position is not ambiguous between many equivalent first moves unless alternatives are stored.

Store solution moves in UCI for reliable validation and SAN for display. Begin from `fenBefore` of the source mistake.

A future puzzle release can use a short principal variation, commonly 1–3 player moves with forced replies. If multiple first moves are objectively acceptable within a configured tolerance, either accept them or do not create the puzzle. Do not incorrectly punish a good move because only one engine line was stored.

## 17. UX requirements

- Desktop-first is acceptable, but the UI should remain usable on a tablet and reasonable mobile width.
- The chessboard must not overflow its container.
- Move selection, board state, evaluation, and annotation must stay synchronized.
- The selected move should be visually obvious.
- Use familiar chess notation and color indicators.
- Keep evaluation data secondary to explanations.
- Do not overwhelm the user with every engine line.
- Loading analysis should communicate the current stage: importing, engine analysis, coaching, saving.
- A refresh should not lose completed work.
- Empty and failed states should offer the next useful action.
- Basic keyboard navigation for game review is desirable: left/right arrows for previous/next, while avoiding interference with text inputs.

## 18. Error handling and resilience

Expected errors include:

- invalid or unsupported PGN;
- database unavailable;
- Stockfish executable unavailable;
- engine timeout or malformed output;
- missing OpenAI key;
- OpenAI network/rate-limit/API error;
- invalid structured response;
- a response referencing nonexistent moves;
- interrupted analysis.

Rules:

- Keep the imported game whenever possible.
- Store analysis status and a sanitized error message.
- Make failed stages retryable.
- Avoid duplicate annotations during retry; use transactions/upserts where appropriate.
- Log enough technical context locally for debugging, but never log API keys or entire sensitive request headers.
- API/UI messages should be actionable.

## 19. Testing strategy

### Unit tests

Prioritize:

- PGN parsing and FEN generation;
- SAN/UCI conversions;
- evaluation perspective normalization;
- centipawn-loss and mate classification;
- critical-moment selection;
- Zod schemas;
- idempotent retry behavior where practical.

### Integration tests

- Import a fixture PGN into a test database.
- Confirm game and moves are persisted correctly.
- Use a deterministic mocked engine adapter to test analysis orchestration.
- Use a mocked OpenAI adapter with valid and invalid structured responses.
- Confirm failed AI analysis preserves engine results.

### Component/E2E tests

- Move navigation updates board position.
- Clicking a critical moment selects the correct ply.
- Import shows validation errors.
- Import requires a valid White/Black selection and preserves it for board orientation and coaching.

Do not make unit tests depend on paid OpenAI requests. Keep real-engine smoke tests separate from fast deterministic tests.

## 20. Environment and local setup

Expected variables may include:

```dotenv
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
STOCKFISH_PATH=
STOCKFISH_DEPTH=
```

Provide:

- `.env.example` without secrets;
- Docker Compose configuration for PostgreSQL;
- Prisma migration instructions;
- engine installation/path instructions for supported development environments;
- one-command or short documented startup flow;
- a README explaining prerequisites and troubleshooting.

The target local flow should be approximately:

```bash
docker compose up -d
npm install
npx prisma migrate dev
npm run dev
```

Do not assume this exact sequence until scripts and versions are defined in the repository.

## 21. Implementation milestones

### Milestone 0 — bootstrap

- Create Next.js TypeScript app.
- Configure Tailwind, linting, tests, environment template, and PostgreSQL Docker service.
- Add Prisma and verify a database connection.

Exit criteria: app starts locally, lint/test commands run, database is reachable.

### Milestone 1 — PGN to interactive board

- Build PGN parser.
- Build import form with a required White/Black selector, PGN textarea, and submit button.
- Temporarily hold or return parsed game data as needed.
- Build board, move list, and navigation.

Exit criteria: a real PGN can be pasted and replayed correctly from start to finish.

### Milestone 2 — persistent game library

- Add Game and GameMove schema/migrations.
- Persist imports, including the selected user color.
- Add `/games` and stable `/games/[id]` review URLs.

Exit criteria: imported games survive restart and can be reopened.

### Milestone 3 — Stockfish

- Implement UCI adapter.
- Analyze moves.
- Normalize evaluations.
- Store best moves/PVs.
- Classify and display critical moves.

Exit criteria: review works with objective engine data and no AI dependency.

### Milestone 4 — AI coach

- Define structured schema.
- Build prompt from engine-selected moments.
- Implement server-only OpenAI adapter.
- Validate and persist summaries/annotations.
- Add retryable failure handling.

Exit criteria: a completed game review contains grounded, educational explanations linked to correct plies.

### Milestone 5 — polished review

- Improve review layout and synchronization.
- Add clickable summary moments and positive highlights.
- Add loading, partial, and error states.
- Add board flip and useful keyboard navigation.

Exit criteria: reviewing a full game is comfortable and coherent.

### Milestone 6 — dashboard and release hardening

- Add a simple game count, recent games, and import/library entry points.
- Finish README, seed/demo fixture, tests, and error handling.
- Review V0.1 scope and remove dead experiments.

Exit criteria: the complete local loop is reliable and documented.

## 22. How to structure `TASKS.md`

Split milestones into roughly 20–30 small tasks. Each task should contain:

```markdown
### TASK-XXX — Short title

Status: TODO | IN_PROGRESS | BLOCKED | DONE
Milestone: M1
Dependencies: TASK-...

#### Description
What must be implemented and why.

#### Scope
- Concrete included work.

#### Out of scope
- Nearby work that must not be included.

#### Acceptance criteria
- Observable behavior.
- Required tests/checks.

#### Verification
- Commands to run.
- Manual flow to check if applicable.

#### Notes
- Decisions, risks, or follow-up work.
```

Example:

```markdown
### TASK-002 — Parse PGN into normalized moves

Status: TODO
Milestone: M1
Dependencies: TASK-001

#### Description
Add a server-safe PGN parsing service using chess.js. Return normalized metadata and every half-move with SAN, UCI, color, move number, fenBefore, and fenAfter.

#### Scope
- Parser and domain types.
- Clear invalid-PGN error.
- Unit fixtures and tests.

#### Out of scope
- Database persistence.
- UI.
- Stockfish analysis.

#### Acceptance criteria
- Valid PGNs return ordered moves and correct positions.
- Invalid or illegal PGNs return a typed error.
- Tests cover castling, promotion, en passant, and checkmate.
- Typecheck, test, and lint pass.

#### Verification
- `npm test`
- `npm run lint`
- `npm run typecheck`
```

## 23. Instructions for Codex

When using this specification in Codex, use the following operating rules:

1. Read this specification, `TASKS.md`, `README.md`, `package.json`, Prisma schema, and relevant existing code before editing.
2. Work only on the task explicitly requested.
3. Preserve user changes and inspect the working tree before editing.
4. Do not redesign settled architecture without explaining a concrete blocker.
5. Prefer small, typed, testable modules.
6. Validate data at trust boundaries.
7. Keep secrets and OpenAI calls server-side.
8. Never use AI output as an unvalidated database payload.
9. Do not invent engine facts in tests or UI; use explicit mocks/fixtures.
10. Add or update tests for changed behavior.
11. Run the narrowest relevant tests while working, followed by the repository's standard verification commands.
12. Update the requested task status and notes only after acceptance criteria pass.
13. Report changed files, tests run, remaining risks, and any blocked acceptance criterion.
14. Do not begin the next task automatically unless explicitly instructed.

A good task prompt is:

> Implement TASK-002 from TASKS.md. Read the repository and `CHESS_COACH_V0.1_SPEC.md` first. Work only within the task scope. Add tests, run the relevant verification commands, and update the task status when its acceptance criteria pass. Do not start another task.

## 24. Definition of done for V0.1

V0.1 is complete when all of the following are true:

- A user can start the documented stack locally.
- A user can select White or Black and paste a valid PGN into the import form.
- The selected color is validated, saved, and used for default board orientation and coaching.
- Invalid PGN receives a useful error.
- The imported game is stored in local PostgreSQL.
- All moves replay correctly on the board.
- Stockfish results are generated and stored consistently.
- Important moves are highlighted without annotating every routine move.
- OpenAI produces validated explanations grounded in supplied engine data.
- Engine analysis remains useful if AI analysis fails.
- A summary and critical moments are easy to navigate.
- Refreshes/restarts do not lose saved games.
- Secrets remain server-side and out of source control.
- Core parsing, color selection, review navigation, analysis orchestration, and validation are tested.
- README setup instructions work on a clean local environment.
- No V0.2-only feature is required to use the app.

## 25. Product direction after V0.1

Future extensions include puzzles generated from personal mistakes, interactive training, and a weakness history built from structured annotations and eventual puzzle attempts. These are not required to complete V0.1.

After enough games, the application should eventually answer questions such as:

- How often does the player miss an opponent's threat?
- Which tactical patterns recur?
- Are opening mistakes mostly theory errors, slow development, or king safety?
- Does the player repeat the same mistake after reviewing it?
- Which personal puzzles are due for repetition?
- What is the best 10-minute training session today?

That is the long-term distinction of Chess Coach: it should become a coach that remembers the player's patterns, not merely another interface around Stockfish.
