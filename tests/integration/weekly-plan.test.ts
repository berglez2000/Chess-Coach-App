import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mutate as mutateLearning } from "@/lib/learning/repository";
import { saveProfile } from "@/lib/learning-profile/repository";
import { planInputs, currentResourceKeys } from "@/lib/weekly-plan/catalog";
import { getPlanState, mutateDraft, startGeneration, finishGeneration } from "@/lib/weekly-plan/repository";
import { generatePlan } from "@/lib/weekly-plan/generate";
import { planProfile, genericPlan } from "../support/weekly-plan-fixtures";
import type { PlanInputs } from "@/lib/weekly-plan/contract";
import { createTestOwner } from "../support/test-owner";
import { createTestDb, assertTestDatabase } from "../support/database";
vi.mock("server-only", () => ({}));
const db = createTestDb(); const owners: string[] = [];
const owner = async () => { const id = await createTestOwner(db); owners.push(id); await saveProfile(db, id, { expectedRevision: 0, answers: planProfile.answers }); return id; };
const action = (expectedRevision: number) => ({ action: "GENERATE" as const, expectedRevision, requestId: randomUUID() });
const client = { generate: vi.fn(async (inputs: PlanInputs) => ({ status: "OK" as const, definition: genericPlan(inputs), model: "fixture-model" })) };
beforeAll(() => assertTestDatabase(db));
afterAll(async () => { await assertTestDatabase(db); await db.user.deleteMany({ where: { id: { in: owners } } }); await db.$disconnect(); });
it("requires a profile and restricts catalog to visible playable content", async () => {
  const noProfile = await createTestOwner(db); owners.push(noProfile);
  await expect(planInputs(db, noProfile)).rejects.toThrow("Save your learning profile");
  const user = await owner(), other = await owner();
  const material = await db.learningMaterial.create({ data: { ownerId: user, title: "Draft-only material", chapters: { create: { title: "Draft chapter" } } } });
  const foreign = await db.learningMaterial.create({ data: { ownerId: other, title: "Other user's book" } });
  const inputs = await planInputs(db, user);
  expect(inputs.resources).not.toContainEqual(expect.objectContaining({ id: material.id }));
  expect(inputs.resources).not.toContainEqual(expect.objectContaining({ id: foreign.id }));
  expect(inputs.resources).toHaveLength(0);
});
it("generates, persists edits, explicitly accepts, and retains input/history on regeneration", async () => {
  const user = await owner(); const request = action(0); const generate = vi.fn(client.generate);
  const draftState = await generatePlan(db, user, request, "OPENAI", { generate });
  expect(draftState.accepted).toBeNull(); expect(draftState.draft?.model).toBe("fixture-model");
  expect((await generatePlan(db, user, request, "OPENAI", { generate })).draft?.id).toBe(draftState.draft?.id); expect(generate).toHaveBeenCalledTimes(1);
  const draft = draftState.draft!; const editedDefinition = { ...draft.definition, title: "My study week" };
  const editAction = { action: "EDIT" as const, expectedRevision: draftState.revision, draftId: draft.id, draftRevision: draft.revision, definition: editedDefinition };
  const edited = await mutateDraft(db, user, editAction);
  expect(edited.draft?.definition.title).toBe("My study week");
  const replay = await mutateDraft(db, user, editAction); expect(replay.revision).toBe(edited.revision);
  const accept = { action: "ACCEPT" as const, expectedRevision: edited.revision, draftId: draft.id, draftRevision: edited.draft!.revision };
  const accepted = await mutateDraft(db, user, accept); expect(accepted.accepted?.version).toBe(1);
  expect((await mutateDraft(db, user, accept)).accepted?.id).toBe(accepted.accepted?.id);
  const reopened = createTestDb(); try { expect(await getPlanState(reopened, user)).toEqual(accepted); } finally { await reopened.$disconnect(); }
  await saveProfile(db, user, { expectedRevision: 1, answers: { ...planProfile.answers, focus: "New focus" } });
  const regenerated = await generatePlan(db, user, action(accepted.revision), "ANTHROPIC", client);
  expect(regenerated.accepted).toEqual(accepted.accepted); expect(regenerated.draft?.inputs.profile.revision).toBe(2);
  const replacement = await mutateDraft(db, user, { action: "ACCEPT", expectedRevision: regenerated.revision, draftId: regenerated.draft!.id, draftRevision: 0 });
  expect(replacement.accepted?.version).toBe(2);
  const old = await db.weeklyPlanVersion.findUniqueOrThrow({ where: { id: accepted.accepted!.id } });
  expect(old.definition).toEqual(editedDefinition); expect((old.inputs as unknown as PlanInputs).profile.revision).toBe(1);
  expect((await db.weeklyPlanGeneration.findUniqueOrThrow({ where: { id: draft.id } })).generatedDefinition).toEqual(draft.definition);
});
it("failed and invalid generation keep accepted plan and prior proposal", async () => {
  const user = await owner(); let state = await generatePlan(db, user, action(0), "OPENAI", client);
  state = await mutateDraft(db, user, { action: "ACCEPT", expectedRevision: state.revision, draftId: state.draft!.id, draftRevision: 0 });
  const accepted = state.accepted; const draftId = state.draft!.id;
  for (const generate of [async () => ({ status: "FAILED" as const, message: "Provider unavailable" }), async (inputs: PlanInputs) => ({ status: "OK" as const, definition: { ...genericPlan(inputs), sessions: [{ day: "Monday" as const, minutes: 50, activity: "Tactics" as const, resourceKey: "invented" }] }, model: "bad-fixture" })]) {
    state = await generatePlan(db, user, action(state.revision), "OPENAI", { generate });
    expect(state.generation?.status).toBe("FAILED"); expect(state.accepted).toEqual(accepted); expect(state.draft?.id).toBe(draftId);
  }
});
it("bounds timeout, ignores late responses, fences expired workers and replays without paid retries", async () => {
  const user = await owner(); const request = action(0);
  let resolve!: (value: Awaited<ReturnType<typeof client.generate>>) => void;
  const generate = vi.fn(() => new Promise<Awaited<ReturnType<typeof client.generate>>>(r => { resolve = r; }));
  const timedOut = await generatePlan(db, user, request, "OPENAI", { generate }, 10);
  expect(timedOut.generation?.status).toBe("FAILED"); expect(timedOut.generation?.error).toContain("timed out");
  resolve({ status: "OK", definition: genericPlan(await planInputs(db, user)), model: "late-model" });
  await generatePlan(db, user, request, "OPENAI", { generate }); expect(generate).toHaveBeenCalledTimes(1); expect((await getPlanState(db, user)).draft).toBeNull();
  const inputs = await planInputs(db, user);
  const old = await startGeneration(db, user, action(timedOut.revision), inputs, "OPENAI", "model");
  await expect(startGeneration(db, user, action((await getPlanState(db, user)).revision), inputs, "OPENAI", "model")).rejects.toThrow("already being generated");
  await db.weeklyPlanGeneration.update({ where: { id: old.generation.id }, data: { leaseUntil: new Date(Date.now() - 1) } });
  expect((await getPlanState(db, user)).generation?.status).toBe("FAILED");
  const newer = await generatePlan(db, user, action((await getPlanState(db, user)).revision), "OPENAI", client);
  expect(await finishGeneration(db, user, old.generation.id, { definition: genericPlan(inputs), model: "stale-model" })).toBe(false);
  expect((await getPlanState(db, user)).draft?.id).toBe(newer.draft?.id);
});
it("isolates direct mutations and serializes simultaneous generation and stale edits", async () => {
  const user = await owner(), other = await owner(); const request = action(0);
  const generate = vi.fn(async (inputs: PlanInputs) => { await new Promise(r => setTimeout(r, 15)); return { status: "OK" as const, definition: genericPlan(inputs), model: "one-call" }; });
  await Promise.all([generatePlan(db, user, request, "OPENAI", { generate }), generatePlan(db, user, request, "OPENAI", { generate })]); expect(generate).toHaveBeenCalledTimes(1);
  const state = await getPlanState(db, user), draft = state.draft!;
  await expect(mutateDraft(db, other, { action: "ACCEPT", expectedRevision: state.revision, draftId: draft.id, draftRevision: 0 })).rejects.toThrow("no longer available");
  expect((await getPlanState(db, other)).draft).toBeNull();
  const results = await Promise.allSettled(["First", "Second"].map(title => mutateDraft(db, user, { action: "EDIT", expectedRevision: state.revision, draftId: draft.id, draftRevision: 0, definition: { ...draft.definition, title } })));
  expect(results.filter(v => v.status === "fulfilled")).toHaveLength(1);
  expect(results.filter(v => v.status === "rejected")).toHaveLength(1);
});
it("rechecks deleted resources before acceptance and permits a generic replacement", async () => {
  const user = await owner(); const book = await db.book.create({ data: { ownerId: user, name: "Endgame notes", digest: randomUUID(), pdf: new Uint8Array([1]), totalPages: 1 } });
  const state = await generatePlan(db, user, action(0), "OPENAI", { generate: async inputs => ({ status: "OK", model: "fixture", definition: { ...genericPlan(inputs), sessions: inputs.profile.answers.availability.map(d => ({ ...d, activity: "Reading", resourceKey: `book:${book.id}` })) } }) });
  await db.book.delete({ where: { id: book.id } });
  expect(await currentResourceKeys(db, user, state.draft!.inputs)).not.toContain(`book:${book.id}`);
  await expect(mutateDraft(db, user, { action: "ACCEPT", expectedRevision: state.revision, draftId: state.draft!.id, draftRevision: 0 })).rejects.toThrow("no longer available");
  const updated = await mutateDraft(db, user, { action: "EDIT", expectedRevision: state.revision, draftId: state.draft!.id, draftRevision: 0, definition: genericPlan(state.draft!.inputs) });
  expect((await mutateDraft(db, user, { action: "ACCEPT", expectedRevision: updated.revision, draftId: updated.draft!.id, draftRevision: updated.draft!.revision })).accepted).not.toBeNull();
});

it("offers actual published chapters, keeps drafts out, and rechecks shared visibility", async () => {
  const user = await owner(), other = await owner();
  const sample = await mutateLearning(db, user, { kind: "sample" });
  await saveProfile(db, user, { expectedRevision: 1, answers: { ...planProfile.answers, resources: [{ kind: "material", id: sample.materialId }] } });
  const inputs = await planInputs(db, user);
  const chapter = inputs.resources.find(r => r.kind === "chapter")!;
  expect(chapter).toMatchObject({ preferred: true, exerciseCount: 1, title: expect.stringContaining("Mate in One") });
  expect((await planInputs(db, other)).resources).not.toContainEqual(expect.objectContaining({ key: chapter.key }));
  await db.learningMaterial.update({ where: { id: sample.materialId }, data: { shared: true } });
  expect((await planInputs(db, other)).resources).toContainEqual(expect.objectContaining({ key: chapter.key }));
  await db.learningMaterial.update({ where: { id: sample.materialId }, data: { shared: false } });
  expect(await currentResourceKeys(db, other, inputs)).not.toContain(chapter.key);
});
