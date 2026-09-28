"use client";
import { useState, type FormEvent } from "react";
import { PROVIDERS, type CoachingProvider, type CoachingSettings } from "@/lib/coaching/providers";

export function CoachingSettingsForm({ settings }: { settings: CoachingSettings }) {
  const [saved, setSaved] = useState(settings);
  const [provider, setProvider] = useState(settings.provider);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error?.message ?? "Could not save settings."); return; }
      setSaved(body); setMessage("Coaching provider saved.");
    } catch { setMessage("Connection lost. Reload settings to check the saved selection."); }
    finally { setPending(false); }
  }
  return <form onSubmit={save} className="mt-6 space-y-4 max-w-lg">
    <p>Saved default: <strong>{PROVIDERS[saved.provider].label}</strong></p>
    <label className="block" htmlFor="coaching-provider">Coaching provider</label>
    <select id="coaching-provider" value={provider} disabled={pending} onChange={event => setProvider(event.target.value as CoachingProvider)} className="w-full rounded border p-3">
      {Object.entries(PROVIDERS).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
    </select>
    <ul className="space-y-2 text-sm">
      {Object.entries(PROVIDERS).map(([value, config]) => <li key={value}>{config.label}: {saved.available[value as CoachingProvider] ? "Key configured" : `Unavailable — set ${config.key} in .env.local and restart the app.`}</li>)}
    </ul>
    <p className="text-sm">This default applies when coaching starts. Saving it makes no AI request and does not change existing reviews. To replace a review’s coaching, use Regenerate coaching on that review. There is no automatic provider fallback.</p>
    <button disabled={pending} className="rounded-lg bg-[#20382e] px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save provider"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
