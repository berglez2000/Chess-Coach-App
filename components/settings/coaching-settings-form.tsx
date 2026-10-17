"use client";
import styles from "@/components/ui/simple-page.module.css";
import { useState, type FormEvent } from "react";
import { COACHING_MODELS, PROVIDERS, type CoachingProvider, type CoachingSettings } from "@/lib/coaching/providers";
import { COACHING_PERSONAS, type CoachingPersona } from "@/lib/coaching/personas";

export function CoachingSettingsForm({ settings }: { settings: CoachingSettings }) {
  const [saved, setSaved] = useState(settings);
  const [provider, setProvider] = useState(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [persona, setPersona] = useState(settings.persona);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, persona }) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error?.message ?? "Could not save settings."); return; }
      setSaved(body); setMessage("Coaching settings saved.");
    } catch { setMessage("Connection lost. Reload settings to check the saved selection."); }
    finally { setPending(false); }
  }
  return <form onSubmit={save} className={styles.form}>
    <p className={styles.saved}>Saved default: <strong>{PROVIDERS[saved.provider].label} · {COACHING_MODELS[saved.provider].find(option => option.id === saved.model)?.label ?? saved.model} · {COACHING_PERSONAS[saved.persona].label}</strong></p>
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
    <label className={styles.label} htmlFor="coaching-persona">Coaching style</label>
    <select id="coaching-persona" value={persona} disabled={pending} onChange={event => setPersona(event.target.value as CoachingPersona)} className={styles.input} aria-describedby="coaching-persona-description">
      {Object.entries(COACHING_PERSONAS).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
    </select>
    <p id="coaching-persona-description" className={styles.hint}>{COACHING_PERSONAS[persona].description}</p>
    <ul className={styles.providers}>
      {Object.entries(PROVIDERS).map(([value, config]) => <li key={value} className={styles.provider}><strong>{config.label}</strong> {saved.available[value as CoachingProvider] ? "Key configured" : `Unavailable — set ${config.key} in .env.local and restart the app.`}</li>)}
    </ul>
    <p className={`${styles.hint} mb-5`}>Your selected model is used for new coaching reviews and weekly plans; the coaching style shapes the voice of game reviews. Models from the same provider share its API key. To update an existing review, use Regenerate coaching on that review.</p>
    <button disabled={pending} className={styles.primary}>{pending ? "Saving…" : "Save settings"}</button>
    {message && <p role="status" className={`${styles.notice} mt-4`}>{message}</p>}
  </form>;
}
