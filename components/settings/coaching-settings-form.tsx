"use client";
import styles from "@/components/ui/simple-page.module.css";
import { useState, type FormEvent } from "react";
import { COACHING_MODELS, PROVIDERS, type CoachingProvider, type CoachingSettings } from "@/lib/coaching/providers";

export function CoachingSettingsForm({ settings }: { settings: CoachingSettings }) {
  const [saved, setSaved] = useState(settings);
  const [provider, setProvider] = useState(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model }) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error?.message ?? "Could not save settings."); return; }
      setSaved(body); setMessage("Coaching model saved.");
    } catch { setMessage("Connection lost. Reload settings to check the saved selection."); }
    finally { setPending(false); }
  }
  return <form onSubmit={save} className={styles.form}>
    <p className={styles.saved}>Saved default: <strong>{PROVIDERS[saved.provider].label} · {COACHING_MODELS[saved.provider].find(option => option.id === saved.model)?.label ?? saved.model}</strong></p>
    <label className={styles.label} htmlFor="coaching-provider">Coaching provider</label>
    <select id="coaching-provider" value={provider} disabled={pending} onChange={event => {
      const next = event.target.value as CoachingProvider;
      setProvider(next); setModel(PROVIDERS[next].model);
    }} className={styles.input}>
      {Object.entries(PROVIDERS).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
    </select>
    <label className={styles.label} htmlFor="coaching-model">AI model</label>
    <select id="coaching-model" value={model} disabled={pending} onChange={event => setModel(event.target.value)} className={styles.input}>
      {COACHING_MODELS[provider].map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <ul className={styles.providers}>
      {Object.entries(PROVIDERS).map(([value, config]) => <li key={value} className={styles.provider}><strong>{config.label}</strong> {saved.available[value as CoachingProvider] ? "Key configured" : `Unavailable — set ${config.key} in .env.local and restart the app.`}</li>)}
    </ul>
    <p className={`${styles.hint} mb-5`}>Your selected model is used for new coaching reviews and weekly plans. Models from the same provider share its API key. To update an existing review, use Regenerate coaching on that review.</p>
    <button disabled={pending} className={styles.primary}>{pending ? "Saving…" : "Save model"}</button>
    {message && <p role="status" className={`${styles.notice} mt-4`}>{message}</p>}
  </form>;
}
