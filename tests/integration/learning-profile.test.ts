import { afterAll, beforeAll, expect, it } from "vitest";
import { getProfile, resourceOptions, saveProfile } from "@/lib/learning-profile/repository";
import { EMPTY_ANSWERS } from "@/lib/learning-profile/contract";
import { assertTestDatabase, createTestDb } from "../support/database";
import { createTestOwner } from "../support/test-owner";
const db = createTestDb();
let owner: string, other: string, materialId: string;
const answers = { ...EMPTY_ANSWERS, goals: ["Reduce blunders"], weaknesses: ["Not sure"], activities: ["Puzzles"], availability: [{ day: "Tuesday", minutes: 20 }] };
beforeAll(async () => {
  await assertTestDatabase(db); owner = await createTestOwner(db); other = await createTestOwner(db);
  materialId = (await db.learningMaterial.create({ data: { ownerId: owner, title: "Private study book" } })).id;
});
afterAll(async () => { await assertTestDatabase(db); await db.user.deleteMany({ where: { id: { in: [owner, other] } } }); await db.$disconnect(); });
it("persists profile edits, keeps immutable earlier inputs and isolates users", async () => {
  expect(await getProfile(db, owner)).toBeNull();
  const first = await saveProfile(db, owner, { expectedRevision: 0, answers });
  const reopened = createTestDb();
  try { expect(await getProfile(reopened, owner)).toEqual(first); } finally { await reopened.$disconnect(); }
  const updated = { ...answers, focus: "Rook endings", resources: [{ kind: "material", id: materialId }] };
  const second = await saveProfile(db, owner, { expectedRevision: 1, answers: updated });
  expect(second.revision).toBe(2); expect(second.resourceTitles[0].title).toBe("Private study book");
  expect((await db.learningProfileRevision.findUniqueOrThrow({ where: { id: first.id } })).answers).toEqual(first.answers);
  expect(await getProfile(db, other)).toBeNull();
  expect(await resourceOptions(db, other)).not.toContainEqual(expect.objectContaining({ id: materialId }));
  await expect(saveProfile(db, other, { expectedRevision: 0, answers: updated })).rejects.toThrow("no longer available");
  await expect(saveProfile(db, owner, { expectedRevision: 1, answers })).rejects.toThrow("another tab");
  expect(await saveProfile(db, owner, { expectedRevision: 1, answers: updated })).toEqual(second);
});
it("serializes simultaneous edits and retains valid data on rejected saves", async () => {
  const before = await getProfile(db, owner);
  const results = await Promise.allSettled(["A", "B"].map(focus => saveProfile(db, owner, { expectedRevision: before!.revision, answers: { ...answers, focus } })));
  expect(results.filter(v => v.status === "fulfilled")).toHaveLength(1);
  expect(results.filter(v => v.status === "rejected")).toHaveLength(1);
  const current = await getProfile(db, owner);
  await expect(saveProfile(db, owner, { expectedRevision: current!.revision, answers: { ...answers, availability: [] } })).rejects.toThrow();
  expect(await getProfile(db, owner)).toEqual(current);
});
