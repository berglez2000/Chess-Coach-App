"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function AccountMenu({ showIdentity = false }: { showIdentity?: boolean }) {
  const { data, isPending } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (isPending) return null;
  if (!data) return <Link href="/sign-in" className="underline">Sign in</Link>;
  return <><Link href="/profile" className={showIdentity ? "flex w-full items-center gap-2 font-medium" : "underline"}>{showIdentity ? <><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--green-subtle)] text-[11px] font-bold">{data.user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="truncate">{data.user.name}</span></> : "Account"}</Link><button className="underline disabled:opacity-50" disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) { setError("Could not sign out. Try again."); return; }
      // Clear cached private pages when the account session ends.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/sign-in");
    } catch { setError("Could not sign out. Try again."); }
    finally { setPending(false); }
  }}>{pending ? "Signing out…" : "Sign out"}</button>{error && <span role="alert">{error}</span>}</>;
}
