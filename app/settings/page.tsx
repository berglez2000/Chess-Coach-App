import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getCoachingSettings } from "@/lib/coaching/settings";
import { CoachingSettingsForm } from "@/components/settings/coaching-settings-form";
import { SimplePage } from "@/components/ui/simple-page";
import styles from "@/components/ui/simple-page.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Settings | Chess Coach" };
export default async function SettingsPage() {
  const user = await requireUser();
  let settings;
  try { settings = await getCoachingSettings(getDb(), user.id); } catch { /* Render actionable, sanitized failure. */ }
  return <SimplePage title="Settings" description="Choose how Chess Coach helps you learn from your games.">
    <section className={`${styles.card} ${styles.settingsCard}`} aria-labelledby="coaching-settings-heading">
      <h2 id="coaching-settings-heading" className={styles.cardTitle}>AI coaching</h2>
      <p className={`${styles.hint} mt-2`}>Choose the provider, model, and coaching style for your reviews and weekly plans.</p>
      {settings ? <CoachingSettingsForm settings={settings} /> : <p role="alert" className={`${styles.error} mt-6`}>Could not load settings. Start local PostgreSQL, apply migrations, then <a href="/settings" className={styles.link}>try again</a>.</p>}
    </section>
  </SimplePage>;
}
