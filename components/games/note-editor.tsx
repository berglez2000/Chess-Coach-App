"use client";

import { useState } from "react";
import { NOTE_MAX_LENGTH } from "@/lib/games/notes";

const buttonClass = "rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed";

/** An optional personal note: a quiet "add" link until one is written. `ply: null` is the note on the whole game. */
export function NoteEditor({ gameId, ply, subject, note, onSaved }: {
  gameId: string; ply: number | null; subject: string; note: string; onSaved: (note: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const label = `Your note on ${subject}`;

  async function save(text: string) {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/games/${gameId}/notes`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ply, text }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message ?? "Could not save this note. Please try again.");
      onSaved(data?.note ?? "");
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this note. Please try again.");
    } finally { setSaving(false); }
  }

  if (draft === null) return note
    ? <section aria-label={label}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[var(--fg-2)]">Your note</h4>
          <button type="button" className="text-sm font-medium text-[var(--fg-3)] underline hover:text-[var(--fg)]" aria-label={`Edit note on ${subject}`} onClick={() => setDraft(note)}>Edit</button>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{note}</p>
      </section>
    : <button type="button" className="text-sm font-medium text-[var(--fg-3)] hover:text-[var(--fg)]" onClick={() => setDraft("")}>+ Add a note on {subject}</button>;

  return <form onSubmit={event => { event.preventDefault(); void save(draft); }}>
    <label className="block text-sm font-semibold text-[var(--fg-2)]">{label}
      <textarea autoFocus rows={3} maxLength={NOTE_MAX_LENGTH} value={draft} onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void save(draft); }
          if (event.key === "Escape") { setDraft(null); setError(""); }
        }}
        className="mt-2 block w-full resize-y rounded-lg border border-[var(--border)] p-2 text-sm font-normal text-[var(--fg)]" />
    </label>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button className={`${buttonClass} border-transparent bg-[var(--green)] text-[var(--on-green)] hover:bg-[var(--green-hover)]`} disabled={saving || draft.trim() === note}>{saving ? "Saving…" : "Save note"}</button>
      <button type="button" className={buttonClass} disabled={saving} onClick={() => { setDraft(null); setError(""); }}>Cancel</button>
      {note && <button type="button" className="ml-auto text-sm text-[var(--fg-3)] underline hover:text-[var(--fg)] disabled:opacity-40" disabled={saving} onClick={() => void save("")}>Delete note</button>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-[var(--status-error)]">{error}</p>}
  </form>;
}
