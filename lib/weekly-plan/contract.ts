import { z } from "zod";
import { DAYS, type SavedProfile } from "@/lib/learning-profile/contract";
import type { CoachingProvider } from "@/lib/coaching/providers";

export const PLAN_ACTIVITIES = ["Tactics", "Own-game puzzles", "Lessons", "Endgames", "Game review", "Reading", "Playing"] as const;
export const RESOURCE_KINDS = ["chapter", "material", "book", "puzzles", "games"] as const;
export const planDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(120),
  sessions: z.array(z.object({
    day: z.enum(DAYS),
    minutes: z.number().int().min(5).max(240),
    activity: z.enum(PLAN_ACTIVITIES),
    resourceKey: z.string().min(1).max(180).nullable(),
  }).strict()).min(1).max(28),
}).strict();
export type PlanDefinition = z.infer<typeof planDefinitionSchema>;
export type PlanResource = { key: string; kind: typeof RESOURCE_KINDS[number]; id: string | null; title: string; href: string; preferred: boolean; activities: typeof PLAN_ACTIVITIES[number][]; exerciseCount?: number };
export type PlanInputs = { schemaVersion: 1; profile: SavedProfile; resources: PlanResource[]; omittedResources: number; promptVersion: 1 };
export type PlanMetadata = { provider: CoachingProvider; model: string; inputs: PlanInputs };
export type PlanDraft = PlanMetadata & { id: string; revision: number; definition: PlanDefinition; createdAt: string };
export type AcceptedPlan = PlanMetadata & { id: string; version: number; generationId: string; draftRevision: number; definition: PlanDefinition; acceptedAt: string };
export type PlanGenerationStatus = { id: string; status: "RUNNING" | "READY" | "FAILED"; error: string | null; leaseUntil: string };
export type PlanState = { revision: number; draft: PlanDraft | null; accepted: AcceptedPlan | null; generation: PlanGenerationStatus | null };
export const EMPTY_PLAN_STATE: PlanState = { revision: 0, draft: null, accepted: null, generation: null };
const editBase = { expectedRevision: z.number().int().min(0), draftId: z.string().min(1).max(100), draftRevision: z.number().int().min(0) };
export const planActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("GENERATE"), requestId: z.uuid(), expectedRevision: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("EDIT"), ...editBase, definition: planDefinitionSchema }).strict(),
  z.object({ action: z.literal("ACCEPT"), ...editBase }).strict(),
]);
export type PlanAction = z.infer<typeof planActionSchema>;
export class PlanError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Shape is only the first check: verify schedule and exact catalog membership. */
export function validatePlan(raw: unknown, inputs: PlanInputs): PlanDefinition {
  const parsed = planDefinitionSchema.safeParse(raw);
  if (!parsed.success) throw new PlanError("The plan has an invalid title, activity, or session length. Each session needs 5–240 whole minutes.");
  const budgets = new Map(inputs.profile.answers.availability.map(day => [day.day, day.minutes]));
  const totals = new Map<string, number>();
  for (const session of parsed.data.sessions) {
    if (!budgets.has(session.day)) throw new PlanError(`${session.day} is outside the saved profile's study days.`);
    totals.set(session.day, (totals.get(session.day) ?? 0) + session.minutes);
    if ((totals.get(session.day) ?? 0) > budgets.get(session.day)!) throw new PlanError(`${session.day} exceeds the saved study-time budget.`);
    if (session.resourceKey !== null) {
      const resource = inputs.resources.find(r => r.key === session.resourceKey);
      if (!resource) throw new PlanError("The plan references a resource that was not available for this proposal.");
      if (!resource.activities.includes(session.activity)) throw new PlanError("The selected resource does not support that activity.");
    } else if (session.activity === "Own-game puzzles") {
      throw new PlanError("Own-game puzzles need an available personal-puzzle library.");
    }
  }
  for (const [day, budget] of budgets) {
    if (totals.get(day) !== budget) throw new PlanError(`${day} must total ${budget} minutes from the saved learning profile.`);
  }
  return parsed.data;
}

// Display text comes from this finite catalog, never from an invented AI resource description.
export const GENERIC_INSTRUCTIONS: Record<typeof PLAN_ACTIVITIES[number], string> = {
  Tactics: "Practice tactical positions from a resource you choose. Compare candidate moves before checking the answer.",
  "Own-game puzzles": "Practice your saved puzzles and review any missed solution.",
  Lessons: "Choose a chess concept to study and write down one idea to try in your games.",
  Endgames: "Study an endgame position using a resource you choose and explain the key idea.",
  "Game review": "Review a recent game and identify a decision you would change.",
  Reading: "Read from a chess resource you choose and note one useful idea.",
  Playing: "Play a game within the session time and note a position to review later.",
};
