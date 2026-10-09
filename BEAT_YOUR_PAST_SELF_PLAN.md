# Beat your past self — implementation plan

Planning date: 2026-10-09. Backlog: TASK-049. The user authorized implementation on 2026-10-09. The tactical first release is implemented; verification evidence is recorded under TASK-049 in FUTURE_TASKS.md.

## Goal

Turn mistakes from the owner's imported games into short replay challenges. Present the position before the mistake without analysis, let the player find an improvement, then compare their attempt with the original move and the validated solution.

Example: a player missed a winning tactic in a saved game. In practice they see that same position, find the tactic, and afterward see “In your game you played …; this time you found …” with the existing coaching explanation when available.

## First release

- Add a “Beat your past self” entry to the personal puzzle library and an entry from a completed game review. The review entry practices that game's eligible positions; the library entry practices across owned games.
- Reuse existing generated personal puzzles. Their conservative validation currently requires a clear winning improvement after a mistake or blunder. This release therefore covers validated tactical opportunities, not every reviewed mistake.
- Default to a short session of up to five challenges, preferring never-attempted positions, then unsuccessful or assisted positions, then previously solved positions. Avoid repeating a position within one session. If fewer are available, use those available.
- Let players retry completed challenges. Record each new challenge attempt independently so earlier completion is preserved.
- After solving or revealing, show the original move, the validated better move, the player's first legal attempt, and relevant saved coaching when present. Link to the exact source position in game review.
- Show a session result such as “3 of 5 solved first try without hints,” with assisted and revealed results separately identified.

No new AI request is required. Generating puzzles remains an explicit existing operation. If no eligible puzzles exist, explain the eligibility rule and link to game review/puzzle generation; never silently start engine work.

## Player flow

1. Start from the puzzle library or a game review. Show how many eligible challenges are available.
2. Display the starting position oriented for the player's color with a neutral prompt: “Find a better move.” Reuse `ReplayBoard` and the shared wooden board/pieces.
3. Hide the recorded move, move-quality label, evaluation, engine lines, coaching, hint arrows, and source-game metadata that could give away the answer. The practice endpoint must also omit these fields before reveal.
4. Accept legal moves using the existing puzzle sequence rules. Automatically play validated opponent replies for multi-move puzzles. A correct first move is not completion when further solver moves are required.
5. An incorrect legal move receives neutral feedback and permits retry. Illegal moves do not count as attempts. Hints and “Show solution” mark the attempt assisted; reveal does not count as a solve.
6. On completion/reveal, display the comparison and explanation. Allow inspection of both the original and solution positions, return to review, or advance to the next challenge.
7. Finish with the session results. Reload resumes the saved session; starting again creates a new session.

## Grading and claims

The engine-validated puzzle solution is authoritative. Reuse the existing unique-best policy and accepted sequence; do not add broad “any better move” grading in this release. Describe rejected moves as “not the validated solution,” rather than claiming every alternative is a blunder.

“First try” means the entire validated sequence was solved with no incorrect legal solver moves, hints, or reveal. Track first legal move, total legal solver attempts, mistakes, hint/reveal use, completion, and timestamps. Retrying within the same challenge does not erase mistakes. A later session creates fresh attempt history.

Do not report rating improvement or a historical progress trend from repeated recognition of the same positions. The first-release results measure challenge performance only. Engine scores, if shown after reveal, must come from matching saved analysis with clear player-relative orientation; omit them when evidence is missing or inconsistent.

## Implementation sequence

### 1. Define session and attempt storage

Inspect `prisma/schema.prisma`, `lib/puzzles/practice-repository.ts`, and `lib/puzzles/solve.ts`. Add owner-scoped practice sessions, an ordered list of selected challenges, and separate per-session attempt state/events with idempotent request IDs and revision checks. Keep existing puzzle completion records intact.

Snapshot each selected puzzle's starting FEN, validated solution/policy version, original move, and source analysis reference server-side. A snapshot lets a session remain consistent when puzzle generation or coaching changes. Finalize deletion behavior against existing ownership/cascade conventions: deleting a source game must not leave retained copies of its private challenge data.

Deliverable: additive migration and tested session selection/state transitions, including fewer than five eligible puzzles and repeated practice of a solved puzzle.

### 2. Add session APIs and spoiler-safe responses

Create/start, load/resume, submit action, advance/skip, and finish operations. Reuse puzzle sequence/legal-move functions while isolating session attempts from the existing single-puzzle progress state. Resolve source moves/coaching through owner-checked queries.

Before reveal, return only the data necessary to play the challenge. After completion/reveal, return the comparison fields and available explanation. Hints expose only their intended hint. Server checks must prevent stale, duplicate, or cross-user requests from advancing or changing results.

Deliverable: stable API contracts, server-authoritative grading, and ownership/spoiler tests.

### 3. Build the challenge and comparison views

Read relevant installed Next.js guides in `node_modules/next/dist/docs/` before code changes. Inspect `components/puzzles/puzzle-solver.tsx`, review navigation, and the shared board components. Follow existing app styling and prepare desktop/mobile design previews before UI implementation, consistent with the project's design-first requirement.

Add session progress, neutral feedback, hint/reveal, resume, skip, and next controls. Reuse board interaction/promotion behavior. After reveal, label “Your original move,” “Your first attempt,” and “Validated solution.” If first attempt is absent because the player revealed immediately, say so. Coaching is optional; its absence does not prevent practice.

Deliverable: complete desktop/mobile flow with keyboard access, correct Black orientation, and the existing wooden appearance.

### 4. Add entry points and session results

Connect game-specific and all-games entry points. Add clear no-puzzles/not-yet-analyzed/generation-failed states using existing generation controls. Results distinguish first-try unassisted solves, solves after retry, assisted solves, reveals, and skips. Resume a current session without silently replacing it.

Deliverable: discoverable workflow from review and the puzzle library, with saved results and source-position navigation.

### 5. Verify and document

- Unit tests: selection order, attempt grading, multi-move completion, illegal moves, hints/reveal, retries, skips, and session totals.
- Integration tests: owner isolation, duplicate/stale requests, reload persistence, independent repeated attempts, snapshot consistency, and source-game deletion.
- Browser tests: full session and resume, empty library, White/Black orientation, promotion, multi-move puzzle, reveal comparison, and mobile layout. Inspect pre-reveal network responses for solution/original-move leaks.
- Run lint, typecheck, relevant unit/integration/browser suites, and production build using the repository's documented build workflow. Record existing unrelated limitations separately.
- Update TASK-049 with implementation evidence before marking DONE.

## Acceptance criteria

A player can start from their own reviewed game or personal puzzle library, solve a hidden validated position, and reveal an accurate comparison with their original move. Attempts survive reload, repeated practice preserves earlier history, session totals match recorded outcomes, and users cannot read another account's challenges. No original move, solution, coaching, or evaluation is sent before its authorized hint/reveal state. Every board retains the shared wooden theme.

## Later extensions

After the tactical release, consider defensive and positional challenges with several acceptable improvements, spaced repetition, and comparisons across attempts. Broader grading needs a separate engine policy for candidate-move evaluation, mate scores, search uncertainty, acceptable alternatives, and bounded compute costs; do not simply relax the current puzzle thresholds.

## Proposed defaults

Five challenges per session; existing validated tactical puzzles only; full puzzle sequence required; no automatic AI calls; entry points in review and the puzzle library. These are planning defaults, not separately confirmed product decisions. The user subsequently authorized implementation of these defaults.
