import { z } from "zod";

export const EXPERIENCES = ["Beginner", "Intermediate", "Experienced", "Not sure"] as const;
export const GOALS = ["Improve tactics", "Reduce blunders", "Understand positions", "Improve endgames", "Prepare for competition", "Build a study habit"] as const;
export const WEAKNESSES = ["Openings", "Calculation", "Strategy", "Endgames", "Time management", "Not sure"] as const;
export const ACTIVITIES = ["Puzzles", "Game review", "Book exercises", "Reading", "Playing"] as const;
export const TIME_CONTROLS = ["Bullet", "Blitz", "Rapid", "Classical", "Correspondence", "Mixed", "Not sure"] as const;
export const FREQUENCIES = ["Rarely", "A few games a week", "Most days", "Every day", "Not sure"] as const;
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const selections = <T extends readonly [string, ...string[]]>(values: T) => z.array(z.enum(values)).min(1, "Choose at least one option.").max(values.length).refine(v => new Set(v).size === v.length, "Choose each option only once.");
export const answersSchema = z.object({
  experience: z.enum(EXPERIENCES),
  rating: z.number().int().min(0).max(4000).nullable(),
  ratingPlatform: z.string().trim().max(100),
  ratingTimeControl: z.enum(TIME_CONTROLS),
  goals: selections(GOALS),
  weaknesses: selections(WEAKNESSES).refine(v => !v.includes("Not sure") || v.length === 1, "Choose specific weaknesses or Not sure."),
  playingFrequency: z.enum(FREQUENCIES),
  usualTimeControl: z.enum(TIME_CONTROLS),
  availability: z.array(z.object({ day: z.enum(DAYS), minutes: z.number().int().min(5).max(240) }).strict()).min(1, "Choose at least one study day.").max(7)
    .refine(v => new Set(v.map(d => d.day)).size === v.length, "Choose each day only once."),
  activities: selections(ACTIVITIES),
  resources: z.array(z.object({ kind: z.enum(["book", "material"]), id: z.string().min(1).max(100) }).strict()).max(100)
    .refine(v => new Set(v.map(r => `${r.kind}:${r.id}`)).size === v.length, "Choose each resource only once."),
  otherResources: z.string().trim().max(1000),
  focus: z.string().trim().max(1000),
}).strict().superRefine((v, ctx) => {
  if (v.rating !== null && !v.ratingPlatform) ctx.addIssue({ code: "custom", path: ["ratingPlatform"], message: "Name the platform or rating system for your rating." });
});
export const saveProfileSchema = z.object({ expectedRevision: z.number().int().min(0), answers: answersSchema }).strict();
export type LearningAnswers = z.infer<typeof answersSchema>;
export type ResourceOption = { kind: "book" | "material"; id: string; title: string };
export type SavedProfile = { id: string; revision: number; answers: LearningAnswers; resourceTitles: ResourceOption[]; savedAt: string };
export const EMPTY_ANSWERS: LearningAnswers = {
  experience: "Not sure", rating: null, ratingPlatform: "", ratingTimeControl: "Not sure", goals: [], weaknesses: [],
  playingFrequency: "Not sure", usualTimeControl: "Not sure", availability: [], activities: [], resources: [], otherResources: "", focus: "",
};
