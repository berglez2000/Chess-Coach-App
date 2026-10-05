import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getProfile } from "@/lib/learning-profile/repository";
import { getCoachingSettings } from "@/lib/coaching/settings";
import { getPlanState } from "@/lib/weekly-plan/repository";
import { currentResourceKeys } from "@/lib/weekly-plan/catalog";
import { planProviderAvailable } from "@/lib/weekly-plan/ai-client";
import { WeeklyPlanEditor } from "@/components/weekly-plan/plan-editor";
export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly learning plan | Chess Coach" };
export default async function WeeklyPlanPage() {
  const user = await requireUser(); const db = getDb();
  const [profile, settings, state] = await Promise.all([getProfile(db, user.id), getCoachingSettings(db, user.id), getPlanState(db, user.id)]);
  const inputs = [state.draft?.inputs, state.accepted?.inputs].filter(input => input !== undefined);
  const keys = await Promise.all(inputs.map(input => currentResourceKeys(db, user.id, input)));
  const availableKeys = [...new Set(keys.flatMap(set => [...set]))];
  return <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
    <Link href="/learning" className="text-sm underline">Return to learning</Link>
    <h1 className="mt-4 text-3xl font-semibold">Weekly learning plan</h1>
    <p className="mt-3">Build a reusable weekly study template from your goals, study time, and available material. Review and edit a proposal before accepting it.</p>
    <WeeklyPlanEditor key={user.id} initial={state} profile={profile} settings={{ ...settings, available: { ANTHROPIC: planProviderAvailable("ANTHROPIC"), OPENAI: planProviderAvailable("OPENAI") } }} availableKeys={availableKeys} />
  </main>;
}
