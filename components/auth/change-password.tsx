"use client";
import styles from "@/components/ui/simple-page.module.css";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { useHydrated } from "./use-hydrated";

export function ChangePassword() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const hydrated = useHydrated();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError(""); setMessage("");
    if (fields.get("newPassword") !== fields.get("confirmation")) { setError("Passwords do not match."); return; }
    setPending(true);
    try {
      const result = await authClient.changePassword({ currentPassword: String(fields.get("currentPassword")), newPassword: String(fields.get("newPassword")), revokeOtherSessions: true });
      if (result.error) { setError("Could not change password. Check your current password, or sign in again if your session expired."); return; }
      form.reset(); setMessage("Password changed. Other devices have been signed out.");
    } catch { setError("Could not reach the server. Please try again."); }
    finally { setPending(false); }
  }
  return <form method="post" onSubmit={submit} ><fieldset disabled={!hydrated || pending} className={styles.fields}><h2 className={styles.cardTitle}>Change password</h2>
    {[["currentPassword", "Current password"], ["newPassword", "New password"], ["confirmation", "Confirm new password"]].map(([name, label]) => <label key={name} className={styles.label}>{label}<input className={styles.input} name={name} type="password" required minLength={name === "currentPassword" ? undefined : 12} maxLength={128} autoComplete={name === "currentPassword" ? "current-password" : "new-password"} disabled={pending} /></label>)}
    <p className={styles.hint}>Use 12–128 characters for your new password.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}
    <button disabled={pending} className={styles.primary}>{pending ? "Saving…" : "Change password"}</button>
  </fieldset></form>;
}
