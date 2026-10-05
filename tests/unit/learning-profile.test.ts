import { describe, expect, it } from "vitest";
import { answersSchema, EMPTY_ANSWERS } from "@/lib/learning-profile/contract";
export const validAnswers = { ...EMPTY_ANSWERS, goals: ["Reduce blunders"], weaknesses: ["Not sure"], activities: ["Puzzles"], availability: [{ day: "Tuesday", minutes: 20 }, { day: "Saturday", minutes: 45 }] };
describe("learning profile validation", () => {
  it("supports an unknown rating and different day budgets", () => { expect(answersSchema.parse(validAnswers).rating).toBeNull(); });
  it("rejects incomplete surveys and invalid schedules", () => {
    for (const answers of [EMPTY_ANSWERS, { ...validAnswers, availability: [] }, { ...validAnswers, availability: [{ day: "Tuesday", minutes: 0 }] }, { ...validAnswers, availability: [{ day: "Tuesday", minutes: 20.5 }] }, { ...validAnswers, availability: [validAnswers.availability[0], validAnswers.availability[0]] }, { ...validAnswers, availability: [{ day: "Saturday", minutes: 241 }] }]) expect(answersSchema.safeParse(answers).success).toBe(false);
  });
  it("requires rating context and rejects ambiguous weaknesses or duplicate choices", () => {
    expect(answersSchema.safeParse({ ...validAnswers, rating: 1200 }).success).toBe(false);
    expect(answersSchema.safeParse({ ...validAnswers, rating: 1200, ratingPlatform: "Lichess" }).success).toBe(true);
    expect(answersSchema.safeParse({ ...validAnswers, weaknesses: ["Not sure", "Openings"] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...validAnswers, goals: ["Reduce blunders", "Reduce blunders"] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...validAnswers, ownerId: "another-user" }).success).toBe(false);
  });
});
