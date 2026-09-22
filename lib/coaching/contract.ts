import { z } from "zod";
import type { MoveQuality } from "@/types/analysis";

// Centralized category list. Use these constants throughout the codebase — never raw strings.
export const COACHING_CATEGORIES = [
  "tactics.fork",
  "tactics.pin",
  "tactics.skewer",
  "tactics.discovered_attack",
  "tactics.removing_defender",
  "tactics.hanging_piece",
  "strategy.weak_square",
  "strategy.bad_piece",
  "strategy.pawn_structure",
  "strategy.space",
  "opening.theory",
  "opening.development",
  "opening.king_safety",
  "opening.premature_attack",
  "calculation.missed_threat",
  "calculation.candidate_moves",
  "calculation.depth",
  "endgame.king_activity",
  "endgame.pawn_ending",
  "endgame.rook_ending",
  "endgame.conversion",
  "practical.time_management",
  "practical.blunder_check",
  "practical.simplification",
  "other",
] as const;
export type CoachingCategory = (typeof COACHING_CATEGORIES)[number];

// Allowed classifications the model may supply. "unknown" is never a valid model output.
export const COACHING_CLASSIFICATIONS = ["normal", "inaccuracy", "mistake", "blunder"] as const;
export type CoachingClassification = (typeof COACHING_CLASSIFICATIONS)[number];

const SUMMARY_MAX = 500;
const LIST_ITEM_MAX = 200;
const LIST_MAX = 5;
const HEADLINE_MAX = 100;
const EXPLANATION_MAX = 600;
const LESSON_MAX = 400;
const MOMENTS_MAX = 10;

const criticalMomentSchema = z.object({
  ply: z.number().int().positive(),
  classification: z.enum(COACHING_CLASSIFICATIONS),
  headline: z.string().min(1).max(HEADLINE_MAX).nullable(),
  explanation: z.string().min(1).max(EXPLANATION_MAX),
  lesson: z.string().min(1).max(LESSON_MAX),
  category: z.enum(COACHING_CATEGORIES),
});

export const coachingResponseSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.string().min(1).max(SUMMARY_MAX),
  strengths: z.array(z.string().min(1).max(LIST_ITEM_MAX)).max(LIST_MAX),
  improvements: z.array(z.string().min(1).max(LIST_ITEM_MAX)).max(LIST_MAX),
  criticalMoments: z.array(criticalMomentSchema).max(MOMENTS_MAX),
});

export type RawCoachingResponse = z.infer<typeof coachingResponseSchema>;

// Application-owned DTO for one annotated moment.
export interface CoachingMoment {
  ply: number;
  /**
   * Engine quality for this ply when available. May be null if the engine result is absent.
   * Classification normalization rule: when engineQuality is non-null and non-"unknown",
   * effectiveClassification uses engineQuality regardless of the model's claim.
   * If engineQuality is null or "unknown", modelClassification is used as-is.
   */
  engineQuality: MoveQuality | null;
  /** The classification value supplied by the model, preserved for traceability. */
  modelClassification: CoachingClassification;
  /** The classification used by the application. Engine wins over model when available. */
  effectiveClassification: MoveQuality;
  headline: string | null;
  explanation: string;
  lesson: string;
  category: CoachingCategory;
}

export interface CoachingAnnotation {
  schemaVersion: 1;
  summary: string;
  strengths: string[];
  improvements: string[];
  moments: CoachingMoment[];
  model: string;
}

export type CrossCheckError =
  | { code: "UNKNOWN_PLY"; ply: number; message: string }
  | { code: "UNSELECTED_PLY"; ply: number; message: string }
  | { code: "DUPLICATE_PLY"; ply: number; message: string };

export interface CrossCheckResult {
  ok: boolean;
  errors: CrossCheckError[];
}

export interface CrossCheckInput {
  response: RawCoachingResponse;
  /** All plies present in this game's moves. */
  gamePlies: Set<number>;
  /** Plies that were selected for coaching (from selectMoments). */
  selectedPlies: Set<number>;
  /** Engine quality by ply, used for classification normalization. */
  engineQuality: Map<number, MoveQuality>;
  /** Model identifier recorded in the annotation. */
  model: string;
}

export function crossCheckCoachingResponse(input: CrossCheckInput): {
  result: CrossCheckResult;
  annotation: CoachingAnnotation | null;
} {
  const { response, gamePlies, selectedPlies, engineQuality, model } = input;
  const errors: CrossCheckError[] = [];
  const seenValidPlies = new Set<number>();

  for (const moment of response.criticalMoments) {
    const { ply } = moment;
    if (!gamePlies.has(ply)) {
      errors.push({ code: "UNKNOWN_PLY", ply, message: `Ply ${ply} does not exist in this game.` });
      continue;
    }
    if (!selectedPlies.has(ply)) {
      errors.push({ code: "UNSELECTED_PLY", ply, message: `Ply ${ply} was not in the selected moments for this game.` });
      continue;
    }
    if (seenValidPlies.has(ply)) {
      errors.push({ code: "DUPLICATE_PLY", ply, message: `Ply ${ply} appears more than once in criticalMoments.` });
      continue;
    }
    seenValidPlies.add(ply);
  }

  if (errors.length > 0) return { result: { ok: false, errors }, annotation: null };

  const moments: CoachingMoment[] = response.criticalMoments.map(moment => {
    const eng = engineQuality.get(moment.ply) ?? null;
    const effectiveClassification: MoveQuality =
      eng !== null && eng !== "unknown" ? eng : moment.classification;
    return {
      ply: moment.ply,
      engineQuality: eng,
      modelClassification: moment.classification,
      effectiveClassification,
      headline: moment.headline,
      explanation: moment.explanation,
      lesson: moment.lesson,
      category: moment.category,
    };
  });

  return {
    result: { ok: true, errors: [] },
    annotation: {
      schemaVersion: 1,
      summary: response.summary,
      strengths: response.strengths,
      improvements: response.improvements,
      moments,
      model,
    },
  };
}
