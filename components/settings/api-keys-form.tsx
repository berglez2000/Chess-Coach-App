"use client";
import styles from "@/components/ui/simple-page.module.css";
import { useState } from "react";
import { PROVIDERS, type CoachingProvider, type CoachingSettings } from "@/lib/coaching/providers";

function keyStatus(settings: CoachingSettings, provider: CoachingProvider): string {
  const personal = settings.personalKeys?.[provider];
  if (personal?.readable) return `Using your key ending in ${personal.lastFour}.`;
  if (personal) return `Your saved key can no longer be read. Enter it again${settings.available[provider] ? "; until then the shared server key is used" : ""}.`;
  if (settings.available[provider]) return settings.personalKeys ? "Using the shared server key. Add your own key to use it instead." : "Using the shared server key.";
  return settings.personalKeys ? "Unavailable — add your key to use this provider." : `Unavailable — set ${PROVIDERS[provider].key} in the server environment and restart the app.`;
}

export function ApiKeysForm({ settings }: { settings: CoachingSettings }) {
  const [saved, setSaved] = useState(settings);
  const [drafts, setDrafts] = useState<Partial<Record<CoachingProvider, string>>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  // Saves the given key, or removes the stored one when no key is given.
  async function update(provider: CoachingProvider, apiKey?: string) {
    if (pending) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/settings/keys/${provider}`, apiKey === undefined ? { method: "DELETE" }
        : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error?.message ?? "Could not update your API key."); return; }
      setSaved(body); setDrafts(current => ({ ...current, [provider]: "" }));
      setMessage(`${PROVIDERS[provider].label} key ${apiKey === undefined ? "removed" : "saved"}.`);
    } catch { setMessage("Connection lost. Reload settings to check your saved keys."); }
    finally { setPending(false); }
  }
  return <div>
    {!saved.personalKeys && <p className={`${styles.notice} mt-4`}>Personal keys are turned off on this server. To turn them on, set API_KEY_ENCRYPTION_SECRET (at least 32 random characters) in the server environment and restart the app.</p>}
    <ul className={styles.providers}>
      {(Object.keys(PROVIDERS) as CoachingProvider[]).map(provider => {
        const label = PROVIDERS[provider].label;
        const draft = drafts[provider] ?? "";
        return <li key={provider} className={styles.provider}><strong>{label}</strong> {keyStatus(saved, provider)}
          {saved.personalKeys && <form className={styles.keyForm} onSubmit={event => { event.preventDefault(); void update(provider, draft.trim()); }}>
            <input aria-label={`${label} API key`} type="password" autoComplete="off" spellCheck={false} required minLength={20} maxLength={512}
              placeholder={saved.personalKeys[provider] ? "Paste a new key to replace yours" : "Paste your key"} value={draft} disabled={pending}
              onChange={event => setDrafts(current => ({ ...current, [provider]: event.target.value }))} className={styles.input} />
            <button disabled={pending || !draft.trim()} className={styles.primary}>Save key</button>
            {saved.personalKeys[provider] && <button type="button" disabled={pending} className={styles.secondary} onClick={() => void update(provider)}>Remove key</button>}
          </form>}
        </li>;
      })}
    </ul>
    {message && <p role="status" className={styles.notice}>{message}</p>}
  </div>;
}
