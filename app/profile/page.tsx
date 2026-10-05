import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { ChangePassword } from "@/components/auth/change-password";
import { SimplePage } from "@/components/ui/simple-page";
import styles from "@/components/ui/simple-page.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your account | Chess Coach" };
export default async function ProfilePage() {
  const user = await requireUser();
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "?";
  return <SimplePage title="Your account" description="Your profile, learning preferences, and account security in one place.">
    <div className={styles.grid}>
      <div className={styles.stack}>
        <section className={styles.card} aria-labelledby="account-details-heading">
          <div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{initials}</span><div><h2 id="account-details-heading">Account details</h2><p className={styles.hint}>Your personal Chess Coach account</p></div></div>
          <dl className={styles.details}><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div></dl>
        </section>
        <section className={styles.card} aria-labelledby="learning-preferences-heading"><h2 id="learning-preferences-heading" className={styles.cardTitle}>Make your study time yours</h2><p className={`${styles.hint} mt-3`}>Set your goals, preferred activities, and weekly availability to shape your learning plan.</p><Link href="/learning/profile" className={`${styles.link} mt-5`}>Edit learning goals and availability <span aria-hidden="true">→</span></Link></section>
      </div>
      <section className={styles.card} aria-label="Account security"><ChangePassword /></section>
    </div>
  </SimplePage>;
}
