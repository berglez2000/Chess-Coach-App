import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getCoachingSettings } from "@/lib/coaching/settings";
import { CoachingSettingsForm } from "@/components/settings/coaching-settings-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Settings | Chess Coach" };
export default async function SettingsPage() {
  const user = await requireUser();
  let settings;
  try { settings = await getCoachingSettings(getDb(), user.id); } catch { /* Render actionable, sanitized failure. */ }
  return <main id="main-content" className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
    <h1 className="text-3xl font-semibold">Settings</h1>
    {settings ? <CoachingSettingsForm settings={settings} /> : <p role="alert" className="mt-6">Could not load settings. Start local PostgreSQL, apply migrations, then <a href="/settings" className="underline">try again</a>.</p>}
  </main>;
}
