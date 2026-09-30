"use client";
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
  return <form method="post" onSubmit={submit} className="mt-8 max-w-md"><fieldset disabled={!hydrated || pending} className="space-y-5"><h2 className="text-xl font-semibold">Change password</h2>
    {[["currentPassword", "Current password"], ["newPassword", "New password"], ["confirmation", "Confirm new password"]].map(([name, label]) => <label key={name} className="block">{label}<input className="mt-2 w-full rounded-lg border border-[#20382e]/30 bg-white p-3" name={name} type="password" required minLength={name === "currentPassword" ? undefined : 12} maxLength={128} autoComplete={name === "currentPassword" ? "current-password" : "new-password"} disabled={pending} /></label>)}
    <p className="text-sm">Use 12–128 characters for your new password.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button disabled={pending} className="rounded-lg bg-[#20382e] px-6 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Change password"}</button>
  </fieldset></form>;
}
