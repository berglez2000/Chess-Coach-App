import type { ChessColor, ParsedGame } from "@/types/game";
import type { NormalizedEvaluation, WhiteScore } from "@/types/analysis";
import type { SelectedMoment } from "@/lib/coaching/select-moments";
import { describePositionFeatures, extractPositionFeatures } from "@/lib/coaching/position-features";
import { COACHING_PERSONAS, DEFAULT_PERSONA, type CoachingPersona } from "@/lib/coaching/personas";
import { COACHING_CATEGORIES, COACHING_CLASSIFICATIONS, type RawCoachingResponse } from "@/lib/coaching/contract";

// V0.1 documented default — not derived from user input, no UI control needed.
const DEFAULT_RATING = 1400;
const DEFAULT_RATING_PLATFORM = "Lichess rapid";

export interface MomentFacts {
  ply: number;
  san: string;
  uci: string;
  mover: ChessColor;
  fenBefore: string;
  fenAfter: string;
  /** White-perspective evaluation before the move. */
  before: NormalizedEvaluation | null;
  /** White-perspective evaluation after the move. */
  after: NormalizedEvaluation | null;
  /** Best move in SAN from fenBefore, if available. */
  bestMoveSan: string | null;
  /** Best move in UCI from fenBefore, if available. */
  bestMoveUci: string | null;
  /** Principal variation in SAN from fenBefore (legal moves only). */
  pvSan: string[];
}

export interface GameArcMove {
  ply: number;
  san: string;
  /** White-perspective evaluation after the move, if analysed. */
  evalAfter: NormalizedEvaluation | null;
}

export interface CoachingPromptInput {
  userColor: ChessColor;
  game: Pick<ParsedGame, "metadata">;
  /** Coaching voice; defaults to the balanced club coach. */
  persona?: CoachingPersona;
  /** Full move list with evaluations, so the model can tell the story of this specific game. */
  arc?: GameArcMove[];
  /** Moments selected by selectMoments, in chronological order. */
  moments: SelectedMoment[];
  /** Engine facts keyed by ply — must cover every ply in moments. */
  momentFacts: Map<number, MomentFacts>;
}

export interface CoachingPromptPayload {
  /** The system instruction sent to the model. */
  systemPrompt: string;
  /** The user message containing game context and selected moments. */
  userMessage: string;
  /** JSON Schema passed to the model for structured output. */
  responseSchema: object;
}

function formatScore(score: WhiteScore, perspective: "WHITE" | "BLACK"): string {
  if (score.kind === "mate") {
    const winning = perspective === "WHITE" ? score.winner === "WHITE" : score.winner === "BLACK";
    const dist = Math.abs(score.value);
    const bound = score.bound !== "exact" ? ` (${score.bound} bound)` : "";
    return winning ? `mate in ${dist}${bound}` : `mated in ${dist}${bound}`;
  }
  // cp value from White's perspective; flip for Black
  const cp = perspective === "WHITE" ? score.value : -score.value;
  const sign = cp > 0 ? "+" : "";
  const bound = score.bound !== "exact" ? ` (${score.bound} bound)` : "";
  return `${sign}${(cp / 100).toFixed(2)}${bound}`;
}

function formatEval(label: string, ev: NormalizedEvaluation | null, perspective: ChessColor): string {
  if (!ev) return `${label}: unavailable`;
  return `${label}: ${formatScore(ev.score, perspective)} (depth ${ev.depth})`;
}

const MOMENT_KIND_LABELS: Record<SelectedMoment["kind"], string> = {
  user_loss: "the user's own mistake",
  positive: "a strong move by the user",
  opponent_context: "an opponent error the user could have punished",
};

/** Rough phase from move number and non-pawn material on the board. */
function gamePhase(ply: number, fen: string): "opening" | "middlegame" | "endgame" {
  const board = fen.split(" ")[0];
  const values: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 };
  let material = 0;
  for (const ch of board.toLowerCase()) material += values[ch] ?? 0;
  if (material <= 26) return "endgame";
  return ply <= 24 ? "opening" : "middlegame";
}

function moveNumberLabel(ply: number, mover: ChessColor): string {
  const n = Math.ceil(ply / 2);
  return mover === "WHITE" ? `${n}.` : `${n}...`;
}

function momentBlock(moment: SelectedMoment, facts: MomentFacts, userColor: ChessColor): string {
  const { ply } = moment;
  const moveLabel = `Ply ${ply} — ${moveNumberLabel(ply, facts.mover)}${facts.san} (${facts.mover === "WHITE" ? "White" : "Black"})`;
  const lines: string[] = [moveLabel];

  lines.push(`  Why selected: ${MOMENT_KIND_LABELS[moment.kind]}${moment.evidence.length > 0 ? ` [${moment.evidence.map(e => e.code).join(", ")}]` : ""}`);
  lines.push(`  Game phase: ${gamePhase(ply, facts.fenBefore)}`);

  lines.push(`  FEN before move: ${facts.fenBefore}`);
  lines.push(`  FEN after move:  ${facts.fenAfter}`);
  lines.push(`  Played (UCI): ${facts.uci}`);

  const before = extractPositionFeatures(facts.fenBefore);
  if (before) lines.push("  Board before move (mover's view):", ...describePositionFeatures(before, facts.mover).map(l => `    ${l}`));
  const after = extractPositionFeatures(facts.fenAfter);
  if (after) lines.push("  Board after move (mover's view):", ...describePositionFeatures(after, facts.mover).map(l => `    ${l}`));

  lines.push(`  ${formatEval("Evaluation before move (White perspective)", facts.before, "WHITE")}`);
  lines.push(`  ${formatEval("Evaluation after move (White perspective)", facts.after, "WHITE")}`);

  if (facts.bestMoveUci && facts.bestMoveSan) {
    lines.push(`  Engine best move from this position: ${facts.bestMoveSan} (${facts.bestMoveUci})`);
    if (facts.pvSan.length > 0) {
      lines.push(`  Engine continuation (SAN): ${facts.pvSan.join(" ")}`);
    }
  } else {
    lines.push("  Engine best move: unavailable");
  }

  // Loss from the mover's perspective for context
  if (facts.before && facts.after) {
    const sign = facts.mover === "WHITE" ? 1 : -1;
    const bScore = facts.before.score;
    const aScore = facts.after.score;
    if (bScore.kind === "cp" && aScore.kind === "cp") {
      const loss = sign * (bScore.value - aScore.value);
      if (loss > 0) lines.push(`  Centipawn loss (mover's perspective): ${Math.round(loss)}`);
    }
  }

  lines.push(`  User is playing: ${userColor === "WHITE" ? "White" : "Black"}`);
  return lines.join("\n");
}

/** Compact move list with the White-perspective evaluation after every full move. */
function formatArc(arc: GameArcMove[]): string {
  const parts: string[] = [];
  for (const move of arc) {
    const white = move.ply % 2 === 1;
    let token = white ? `${Math.ceil(move.ply / 2)}. ${move.san}` : move.san;
    if (!white && move.evalAfter) token += ` {${formatScore(move.evalAfter.score, "WHITE")}}`;
    parts.push(token);
  }
  const last = arc[arc.length - 1];
  if (last.ply % 2 === 1 && last.evalAfter) parts[parts.length - 1] += ` {${formatScore(last.evalAfter.score, "WHITE")}}`;
  return `(Evaluations in braces are White perspective, after Black's move.)\n${parts.join(" ")}`;
}

/** Pure — builds a prompt payload from supplied engine facts. No network calls. */
export function buildCoachingPrompt(input: CoachingPromptInput): CoachingPromptPayload {
  const { userColor, game, moments, momentFacts } = input;
  const meta = game.metadata;

  const persona = COACHING_PERSONAS[input.persona ?? DEFAULT_PERSONA];
  const systemPrompt = `${persona.voice}

Your goal: the student should finish reading and feel "this review could only be about MY game." A review that would fit any other game is a failed review.

How to write it:
- Tell the story of this game. Use the move list and evaluation trend to find its shape: who was better when, where it turned, and why the result happened. Name the single turning point.
- Anchor every claim in the game: cite move numbers (e.g. "on move 14..."), pieces, and squares. Never write a sentence that contains no game-specific detail.
- Pick ONE main theme for this game (e.g. "king left in the centre", "trading into a lost endgame", "missed tactics after the opponent's errors") and let the summary, improvements and lessons connect to it. If the same kind of error repeats, say so explicitly — a pattern is more useful than a list.
- Strengths are real and specific (a move, a plan, a defensive resource), not consolation. If there is little to praise, give fewer strengths rather than vague ones.
- Each improvement is a concrete habit tied to a moment in this game, not a general platitude.
- Each lesson must be different from the others. Phrase it as a rule of thumb or a question the student can ask at the board in a similar position.
- Use the board features (material, loose pieces, king safety) to explain WHY a move mattered in concrete terms: e.g. a piece left loose after the move, a missed chance to win an opponent's loose piece, or a king with no pawn shield. Compare "before" and "after" to see what the move changed.
- Vary sentence openings and structure between moments. Match the tone to the game: a hard-fought loss, a crushing win, and a swindle should read differently.
- Opponent errors ("an opponent error the user could have punished") are about the user's missed chance to react, not about praising or blaming the opponent.

Avoid these generic phrases and anything like them: "solid opening", "it's important to", "always look for checks, captures and threats", "stay focused", "be careful", "keep practicing", "in the middlegame you made some mistakes", "overall a good game". Do not start the summary with "You played" or "This game".

Accuracy rules you must follow:
- Stockfish data in this request is authoritative. Do not invent evaluations, centipawn values, or scores.
- Only suggest moves that appear in the supplied engine data (bestMove or principal variation). Do not fabricate alternative lines.
- Board features are computed statically (no search). "Loose" means attacked and undefended or attacked by a cheaper piece — it may still be tactically safe, so confirm with the engine line before claiming it can be won.
- You may describe ideas visible in the supplied FENs and lines (an undefended piece, an open file, a pin), but do not invent tactical patterns not supported by the supplied data. When unsure, describe the consequence shown by the engine line instead of naming a motif.
- Do not label a move brilliant.

Audience and format:
- Write for an approximately ${DEFAULT_RATING} ${DEFAULT_RATING_PLATFORM} player: practical, educational, no advanced jargon. Speak to them as "you". Stay in the coaching voice described above throughout.
- Be concise. Explanations fit a review panel (under 600 characters). Lessons under 400 characters.
- Distinguish lesson categories using only the allowed values.
- Return only the JSON structure described. No prose outside JSON.`;

  const colorLabel = userColor === "WHITE" ? "White" : "Black";
  const oppLabel = userColor === "WHITE" ? "Black" : "White";

  const metaLines: string[] = [`User's color: ${colorLabel}`, `Opponent's color: ${oppLabel}`];
  if (meta.whiteName) metaLines.push(`White player: ${meta.whiteName}`);
  if (meta.blackName) metaLines.push(`Black player: ${meta.blackName}`);
  if (meta.result) metaLines.push(`Result: ${meta.result}`);
  if (meta.event) metaLines.push(`Event: ${meta.event}`);
  if (meta.playedAt) metaLines.push(`Date: ${meta.playedAt}`);
  if (meta.openingName) metaLines.push(`Opening: ${meta.openingName}`);
  if (meta.eco) metaLines.push(`ECO: ${meta.eco}`);
  if (meta.timeControl) metaLines.push(`Time control: ${meta.timeControl}`);

  const momentBlocks = moments.map(m => {
    const facts = momentFacts.get(m.ply);
    if (!facts) throw new Error(`Missing engine facts for selected ply ${m.ply}.`);
    return momentBlock(m, facts, userColor);
  });

  const arcSection = input.arc && input.arc.length > 0 ? ["## Full game with evaluation trend", formatArc(input.arc), ""] : [];

  const categoryList = COACHING_CATEGORIES.map(c => `    "${c}"`).join(",\n");
  const classificationList = COACHING_CLASSIFICATIONS.map(c => `"${c}"`).join(", ");

  const schemaInstructions = `Output a JSON object with exactly this shape (schemaVersion must be 1):
{
  "schemaVersion": 1,
  "summary": "<string, max 500 chars — overall game assessment>",
  "strengths": ["<string, max 200 chars>", ...],        // 0–5 items
  "improvements": ["<string, max 200 chars>", ...],     // 0–5 items
  "criticalMoments": [
    {
      "ply": <integer — must be one of the supplied moment plies>,
      "classification": <one of: ${classificationList}>,
      "headline": <string max 100 chars naming what happened on the board, or null>,
      "explanation": "<string 1–600 chars>",
      "lesson": "<string 1–400 chars>",
      "category": <one of the allowed categories below>
    },
    ...   // cover only the supplied moment plies — no others
  ]
}

Allowed categories:
${categoryList}`;

  const userMessage = [
    "## Game context",
    metaLines.join("\n"),
    "",
    ...arcSection,
    "## Selected moments for coaching",
    `(${moments.length === 0 ? "No moments were selected — provide a general summary only, with empty criticalMoments." : `${moments.length} moment${moments.length > 1 ? "s" : ""} — provide criticalMoments entries for each`})`,
    "",
    ...momentBlocks.flatMap(block => [block, ""]),
    "## Output format",
    schemaInstructions,
  ].join("\n");

  // Provide the JSON Schema for structured-output APIs.
  const responseSchema: RawCoachingResponse extends object ? object : never = {
    type: "object",
    required: ["schemaVersion", "summary", "strengths", "improvements", "criticalMoments"],
    additionalProperties: false,
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      summary: { type: "string", minLength: 1, maxLength: 500 },
      strengths: { type: "array", maxItems: 5, items: { type: "string", minLength: 1, maxLength: 200 } },
      improvements: { type: "array", maxItems: 5, items: { type: "string", minLength: 1, maxLength: 200 } },
      criticalMoments: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          required: ["ply", "classification", "headline", "explanation", "lesson", "category"],
          additionalProperties: false,
          properties: {
            ply: { type: "integer", minimum: 1 },
            classification: { type: "string", enum: [...COACHING_CLASSIFICATIONS] },
            headline: { type: ["string", "null"], maxLength: 100 },
            explanation: { type: "string", minLength: 1, maxLength: 600 },
            lesson: { type: "string", minLength: 1, maxLength: 400 },
            category: { type: "string", enum: [...COACHING_CATEGORIES] },
          },
        },
      },
    },
  };

  return { systemPrompt, userMessage, responseSchema };
}
