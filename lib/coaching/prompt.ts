import type { ChessColor, ParsedGame } from "@/types/game";
import type { NormalizedEvaluation, WhiteScore } from "@/types/analysis";
import type { SelectedMoment } from "@/lib/coaching/select-moments";
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

export interface CoachingPromptInput {
  userColor: ChessColor;
  game: Pick<ParsedGame, "metadata">;
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

function momentBlock(ply: number, facts: MomentFacts, userColor: ChessColor): string {
  const moveLabel = `Ply ${ply} — ${facts.mover === "WHITE" ? "White" : "Black"}: ${facts.san}`;
  const lines: string[] = [moveLabel];

  lines.push(`  FEN before move: ${facts.fenBefore}`);
  lines.push(`  FEN after move:  ${facts.fenAfter}`);
  lines.push(`  Played (UCI): ${facts.uci}`);
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

/** Pure — builds a prompt payload from supplied engine facts. No network calls. */
export function buildCoachingPrompt(input: CoachingPromptInput): CoachingPromptPayload {
  const { userColor, game, moments, momentFacts } = input;
  const meta = game.metadata;

  const systemPrompt = `You are a chess coach producing structured feedback for an improving player.

Rules you must follow:
- Stockfish data in this request is authoritative. Do not invent evaluations, centipawn values, or scores.
- Only suggest moves that appear in the supplied engine data (bestMove or principal variation). Do not fabricate alternative lines.
- Write for an approximately ${DEFAULT_RATING} ${DEFAULT_RATING_PLATFORM} player: practical, educational, no advanced jargon.
- Focus on transferable lessons the player can apply in future games — not memorizing one engine move.
- Be concise. explanations fit a review panel (under 600 characters). lessons under 400 characters.
- Return only the JSON structure described. No prose outside JSON.
- Distinguish lesson categories using only the allowed values.
- Do not label a move brilliant. Do not invent tactical patterns not supported by the supplied data.`;

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
    return momentBlock(m.ply, facts, userColor);
  });

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
      "headline": <string max 100 chars, or null>,
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
