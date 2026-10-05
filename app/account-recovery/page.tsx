import Link from "next/link";
import { AuthPage } from "@/components/ui/simple-page";
import styles from "@/components/ui/simple-page.module.css";
export const metadata = { title: "Recover your account | Chess Coach" };
export default function RecoveryPage() {
  return <AuthPage title="Recover your account" description="Get back to your games and learning progress.">
    <div className={`${styles.notice} mt-6`}><p className="font-semibold">Password recovery on this installation</p><p className="mt-2">This personal installation uses local password recovery. Ask the person running Chess Coach to reset your password using the account-recovery instructions in the README.</p></div>
    <p className={`${styles.hint} mt-5`}>Your games will stay with your account. You will need to sign in again on every device.</p>
    <Link href="/sign-in" className={`${styles.primary} ${styles.fullWidth} mt-6`}>Back to sign in</Link>
  </AuthPage>;
}
