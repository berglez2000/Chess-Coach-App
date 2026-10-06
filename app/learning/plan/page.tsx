import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getProfile } from "@/lib/learning-profile/repository";
import { getCoachingSettings } from "@/lib/coaching/settings";
import { getPlanState } from "@/lib/weekly-plan/repository";
import { currentResourceKeys } from "@/lib/weekly-plan/catalog";
import { planProviderAvailable } from "@/lib/weekly-plan/ai-client";
import { WeeklyPlanEditor } from "@/components/weekly-plan/plan-editor";
import shared from "@/components/ui/simple-page.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly learning plan | Chess Coach" };
export default async function WeeklyPlanPage() {
  const user = await requireUser(); const db = getDb();
  const [profile, settings, state] = await Promise.all([getProfile(db, user.id), getCoachingSettings(db, user.id), getPlanState(db, user.id)]);
  const inputs = [state.draft?.inputs, state.accepted?.inputs].filter(input => input !== undefined);
  const keys = await Promise.all(inputs.map(input => currentResourceKeys(db, user.id, input)));
  const availableKeys = [...new Set(keys.flatMap(set => [...set]))];
  return <main id="main-content" className={shared.page}>
    <nav className={shared.breadcrumb} aria-label="Breadcrumb"><Link href="/learning">Return to learning</Link><span aria-hidden="true">/</span><span>Weekly plan</span></nav>
    <header>
      <p className={shared.eyebrow}>A little progress, every week</p>
      <h1 className={shared.heading}>Weekly learning plan</h1>
      <p className={shared.description}>Make time for better chess. Build a reusable study routine around your goals, schedule, and learning materials.</p>
    </header>
    <WeeklyPlanEditor key={user.id} initial={state} profile={profile} settings={{ ...settings, available: { ANTHROPIC: planProviderAvailable("ANTHROPIC"), OPENAI: planProviderAvailable("OPENAI") } }} availableKeys={availableKeys} />
  </main>;
}
