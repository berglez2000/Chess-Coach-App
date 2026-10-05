import { EMPTY_ANSWERS, type SavedProfile } from "@/lib/learning-profile/contract";
import type { PlanDefinition, PlanInputs } from "@/lib/weekly-plan/contract";
export const planProfile: SavedProfile = { id: "profile-1", revision: 1, savedAt: "2026-10-04T10:00:00.000Z", resourceTitles: [], answers: {
  ...EMPTY_ANSWERS, goals: ["Reduce blunders"], weaknesses: ["Calculation"], activities: ["Puzzles", "Game review"], availability: [{ day: "Tuesday", minutes: 20 }, { day: "Saturday", minutes: 45 }],
} };
export const fixtureInputs: PlanInputs = { schemaVersion: 1, profile: planProfile, omittedResources: 0, promptVersion: 1, resources: [
  { key: "chapter:chapter-1", kind: "chapter", id: "chapter-1", title: "Tactics book / Mate in One", href: "/learning/chapters/chapter-1", preferred: true, activities: ["Tactics", "Lessons"], exerciseCount: 3 },
  { key: "puzzles", kind: "puzzles", id: null, title: "Your saved puzzles", href: "/puzzles", preferred: true, activities: ["Own-game puzzles", "Tactics"] },
] };
export const fixturePlan: PlanDefinition = { schemaVersion: 1, title: "Weekly chess study", sessions: [
  { day: "Tuesday", minutes: 20, activity: "Tactics", resourceKey: "chapter:chapter-1" },
  { day: "Saturday", minutes: 25, activity: "Own-game puzzles", resourceKey: "puzzles" },
  { day: "Saturday", minutes: 20, activity: "Endgames", resourceKey: null },
] };
export function genericPlan(inputs: PlanInputs): PlanDefinition {
  return { schemaVersion: 1, title: "Weekly chess study", sessions: inputs.profile.answers.availability.map(d => ({ ...d, activity: "Tactics", resourceKey: null })) };
}
