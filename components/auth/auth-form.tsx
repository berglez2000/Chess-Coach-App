"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { useHydrated } from "./use-hydrated";

export function AuthForm({ mode }: { mode: "sign-in" | "register" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const hydrated = useHydrated();
  const register = mode === "register";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "").trim().toLowerCase();
    const password = String(fields.get("password") ?? "");
    if (register && password !== fields.get("confirmation")) { setError("Passwords do not match."); return; }
    setPending(true); setError("");
    try {
      const result = register
        ? await authClient.signUp.email({ name: String(fields.get("name") ?? "").trim(), email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.status === 429 ? "Too many attempts. Wait a minute and try again." : register
          ? "Could not create your account. Check your details, or sign in if you already have an account."
          : "Could not sign in. Check your email and password and try again.");
        return;
      }
      // A full navigation clears any private data left in the client router cache.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch { setError("Could not reach the server. Please try again."); }
    finally { setPending(false); }
  }
  const inputClass = "mt-2 w-full rounded-lg border border-[#20382e]/30 bg-white p-3";
  return <form method="post" onSubmit={submit} className="mt-8"><fieldset disabled={!hydrated || pending} className="space-y-5">
    {register && <label className="block">Name<input className={inputClass} name="name" autoComplete="name" required maxLength={100} disabled={pending} /></label>}
    <label className="block">Email<input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} /></label>
    <label className="block">Password<input className={inputClass} name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 12 : undefined} maxLength={128} disabled={pending} /></label>
    {register && <><p className="text-sm text-[#465c50]">Use 12–128 characters. A long, unique passphrase works well.</p><label className="block">Confirm password<input className={inputClass} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} /></label></>}
    {error && <p role="alert">{error}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-[#20382e] px-6 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
    <p>{register ? "Already have an account? " : "New to Chess Coach? "}<Link className="underline" href={register ? "/sign-in" : "/register"}>{register ? "Sign in" : "Create account"}</Link></p>
    {!register && <Link className="inline-block underline" href="/account-recovery">Forgot your password?</Link>}
  </fieldset></form>;
}
