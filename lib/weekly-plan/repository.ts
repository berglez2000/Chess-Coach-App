import type { PrismaClient, Prisma, WeeklyPlanGeneration } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import type { CoachingProvider } from "@/lib/coaching/providers";
import { currentResourceKeys } from "./catalog";
import { EMPTY_PLAN_STATE, PlanError, validatePlan, type PlanState, type PlanInputs, type PlanDefinition, type PlanAction } from "./contract";
export const GENERATION_LEASE_MS = 120_000;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const include = { draft: true, accepted: true, generation: true } as const;
const conflict = () => { throw new PlanError("Your plan changed in another request. Refresh the plan before trying again.", 409); };

export async function getPlanState(db: PrismaClient, userId: string): Promise<PlanState> {
  const workspace = await db.weeklyPlanWorkspace.findUnique({ where: { userId: requireOwnerId(userId) }, include });
  if (!workspace) return { ...EMPTY_PLAN_STATE };
  const { draft, accepted, generation } = workspace;
  const expired = generation?.status === "RUNNING" && generation.leaseUntil.getTime() <= Date.now();
  return { revision: workspace.revision,
    draft: draft?.definition && draft.model ? { id: draft.id, revision: draft.draftRevision, definition: draft.definition as PlanDefinition,
      provider: draft.provider, model: draft.model, inputs: draft.inputs as unknown as PlanInputs, createdAt: draft.createdAt.toISOString() } : null,
    accepted: accepted ? { id: accepted.id, version: accepted.version, generationId: accepted.generationId, draftRevision: accepted.draftRevision, definition: accepted.definition as PlanDefinition,
      provider: accepted.provider, model: accepted.model, inputs: accepted.inputs as unknown as PlanInputs, acceptedAt: accepted.acceptedAt.toISOString() } : null,
    generation: generation ? { id: generation.id, status: expired ? "FAILED" : generation.status as "RUNNING" | "READY" | "FAILED",
      error: expired ? "The previous generation did not finish. Your saved plans are preserved; generate again when ready." : generation.error, leaseUntil: generation.leaseUntil.toISOString() } : null,
  };
}
export async function startGeneration(db: PrismaClient, userId: string, action: Extract<PlanAction, { action: "GENERATE" }>, inputs: PlanInputs, provider: CoachingProvider, requestedModel: string) {
  requireOwnerId(userId);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const existing = await tx.weeklyPlanGeneration.findUnique({ where: { userId_requestId: { userId, requestId: action.requestId } } });
    if (existing) {
      if (existing.baseRevision !== action.expectedRevision) conflict();
      return { claimed: false, generation: existing };
    }
    const workspace = await tx.weeklyPlanWorkspace.upsert({ where: { userId }, create: { userId }, update: {}, include: { generation: true } });
    if (workspace.revision !== action.expectedRevision) conflict();
    if (workspace.generation?.status === "RUNNING") {
      if (workspace.generation.leaseUntil.getTime() > Date.now()) throw new PlanError("A plan is already being generated. Refresh to check its progress.", 409);
      await tx.weeklyPlanGeneration.update({ where: { id: workspace.generation.id }, data: { status: "FAILED", error: "The generation expired. Saved plans were preserved." } });
    }
    const generation = await tx.weeklyPlanGeneration.create({ data: { userId, requestId: action.requestId, baseRevision: workspace.revision, inputs: json(inputs), provider, requestedModel,
      leaseUntil: new Date(Date.now() + GENERATION_LEASE_MS) } });
    await tx.weeklyPlanWorkspace.update({ where: { userId }, data: { generationId: generation.id, revision: { increment: 1 } } });
    return { claimed: true, generation };
  });
}
export async function finishGeneration(db: PrismaClient, userId: string, generationId: string, outcome: { definition: PlanDefinition; model: string } | { error: string }) {
  requireOwnerId(userId);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const workspace = await tx.weeklyPlanWorkspace.findUnique({ where: { userId }, include: { generation: true } });
    const generation = workspace?.generation;
    if (!generation || generation.id !== generationId || generation.userId !== userId || generation.status !== "RUNNING" || generation.leaseUntil.getTime() <= Date.now()) return false;
    let error = "error" in outcome ? outcome.error : null;
    let definition: PlanDefinition | null = null;
    if ("definition" in outcome) {
      try {
        const inputs = generation.inputs as unknown as PlanInputs;
        definition = validatePlan(outcome.definition, inputs);
        const keys = await currentResourceKeys(tx, userId, inputs);
        if (definition.sessions.some(s => s.resourceKey && !keys.has(s.resourceKey))) throw new PlanError("A proposed resource became unavailable. Generate again using the updated content.");
      } catch (cause) { error = cause instanceof PlanError ? cause.message : "Could not validate the generated plan."; }
    }
    await tx.weeklyPlanGeneration.update({ where: { id: generationId }, data: definition && !error && "model" in outcome
      ? { status: "READY", definition: json(definition), generatedDefinition: json(definition), model: outcome.model, error: null }
      : { status: "FAILED", error: error ?? "The provider returned no valid plan." } });
    await tx.weeklyPlanWorkspace.update({ where: { userId }, data: { revision: { increment: 1 }, ...(definition && !error ? { draftId: generationId } : {}) } });
    return true;
  });
}
export async function mutateDraft(db: PrismaClient, userId: string, action: Exclude<PlanAction, { action: "GENERATE" }>) {
  requireOwnerId(userId);
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const workspace = await tx.weeklyPlanWorkspace.findUnique({ where: { userId }, include });
    const draft = workspace?.draft;
    if (!workspace || !draft || draft.id !== action.draftId || draft.userId !== userId || !draft.definition || !draft.model) throw new PlanError("This plan proposal is no longer available. Refresh to see the current proposal.", 404);
    // Replaying an accepted version returns the current state without duplicating history.
    if (action.action === "ACCEPT" && workspace.accepted?.generationId === draft.id && workspace.accepted.draftRevision === action.draftRevision) return;
    if (action.action === "EDIT" && JSON.stringify(validatePlan(draft.definition, draft.inputs as unknown as PlanInputs)) === JSON.stringify(validatePlan(action.definition, draft.inputs as unknown as PlanInputs))) return;
    if (workspace.revision !== action.expectedRevision || draft.draftRevision !== action.draftRevision) conflict();
    if (workspace.generation?.status === "RUNNING" && workspace.generation.leaseUntil.getTime() > Date.now()) throw new PlanError("Wait for generation to finish before changing the proposal.", 409);
    const inputs = draft.inputs as unknown as PlanInputs;
    const definition = validatePlan(action.action === "EDIT" ? action.definition : draft.definition, inputs);
    const keys = await currentResourceKeys(tx, userId, inputs);
    if (definition.sessions.some(s => s.resourceKey && !keys.has(s.resourceKey))) throw new PlanError("A selected resource is no longer available. Edit the proposal to choose another resource or generic study.");
    if (action.action === "EDIT") {
      await tx.weeklyPlanGeneration.update({ where: { id: draft.id }, data: { definition: json(definition), draftRevision: { increment: 1 } } });
      await tx.weeklyPlanWorkspace.update({ where: { userId }, data: { revision: { increment: 1 } } });
    } else {
      const version = await tx.weeklyPlanVersion.create({ data: { userId, version: (workspace.accepted?.version ?? 0) + 1,
        generationId: draft.id, draftRevision: draft.draftRevision, definition: json(definition), inputs: draft.inputs as Prisma.InputJsonValue, provider: draft.provider, model: draft.model } });
      await tx.weeklyPlanWorkspace.update({ where: { userId }, data: { acceptedId: version.id, revision: { increment: 1 } } });
    }
  });
  return getPlanState(db, userId);
}
export function generationInputs(row: WeeklyPlanGeneration): PlanInputs { return row.inputs as unknown as PlanInputs; }
