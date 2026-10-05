"use client";
import { useRef, useState } from "react";
import { ACTIVITIES, DAYS, EMPTY_ANSWERS, EXPERIENCES, FREQUENCIES, GOALS, TIME_CONTROLS, WEAKNESSES, answersSchema, type LearningAnswers, type ResourceOption, type SavedProfile } from "@/lib/learning-profile/contract";

const inputClass = "mt-2 w-full rounded-lg border border-[#20382e]/30 bg-white p-2";
const buttonClass = "rounded-lg bg-[#20382e] px-4 py-2 text-white disabled:opacity-50";
function Choices({ title, options, selected, onChange }: { title: string; options: readonly string[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="rounded-xl border border-[#20382e]/15 p-4"><legend className="px-1 font-semibold">{title}</legend><div className="flex flex-wrap gap-x-5 gap-y-3">{options.map(option => <label key={option} className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(option)} onChange={e => onChange(e.target.checked ? [...selected, option] : selected.filter(v => v !== option))} />{option}</label>)}</div></fieldset>;
}
export function LearningProfileForm({ initial, resources }: { initial: SavedProfile | null; resources: ResourceOption[] }) {
  const [saved, setSaved] = useState(initial);
  const [answers, setAnswers] = useState<LearningAnswers>(initial?.answers ?? EMPTY_ANSWERS);
  const [stage, setStage] = useState<"edit" | "review" | "saved">(initial ? "saved" : "edit");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  function change<K extends keyof LearningAnswers>(key: K, value: LearningAnswers[K]) { setAnswers(a => ({ ...a, [key]: value })); }
  function go(next: typeof stage) { setStage(next); setError(""); requestAnimationFrame(() => heading.current?.focus()); }
  const minutes = answers.availability.reduce((total, day) => total + day.minutes, 0);
  const selectedResources = answers.resources.map(r => resources.find(option => option.kind === r.kind && option.id === r.id) ?? saved?.resourceTitles.find(option => option.kind === r.kind && option.id === r.id));
  async function save() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/learning/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: saved?.revision ?? 0, answers }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not save your learning profile.");
      const profile = body.profile as SavedProfile;
      setSaved(profile); setAnswers(profile.answers); go("saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your learning profile. Try again."); }
    finally { setPending(false); }
  }
  return <section className="mt-8">
    <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{stage === "edit" ? "Your goals and study time" : stage === "review" ? "Review your answers" : "Your saved learning profile"}</h2>
    {error && <p role="alert" aria-label="Learning profile feedback" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3">{error}</p>}
    {stage === "edit" ? <form className="mt-6 space-y-6" onSubmit={e => {
      e.preventDefault(); const result = answersSchema.safeParse(answers);
      if (!result.success) { setError(result.error.issues.map(issue => `${({ goals: "Main goals", weaknesses: "Weak areas", availability: "Study days and time", activities: "Preferred activities", ratingPlatform: "Rating platform" } as Record<string, string>)[String(issue.path[0])] ?? "Your answers"}: ${issue.message}`).join(" ")); return; }
      setAnswers(result.data); go("review");
    }}>
      <label className="block font-semibold">1. Experience<select className={inputClass} value={answers.experience} onChange={e => change("experience", e.target.value as LearningAnswers["experience"])}>{EXPERIENCES.map(v => <option key={v}>{v}</option>)}</select></label>
      <fieldset className="rounded-xl border border-[#20382e]/15 p-4"><legend className="px-1 font-semibold">2. Rating (optional)</legend>
        <p className="text-sm">Leave the rating blank if you do not know it.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label>Rating<input type="number" min={0} max={4000} step={1} className={inputClass} value={answers.rating ?? ""} onChange={e => change("rating", e.target.value === "" ? null : Number(e.target.value))} /></label>
          <label>Platform or rating system<input className={inputClass} maxLength={100} value={answers.ratingPlatform} onChange={e => change("ratingPlatform", e.target.value)} placeholder="e.g. Chess.com, Lichess, FIDE" /></label>
          <label>Rating time control<select className={inputClass} value={answers.ratingTimeControl} onChange={e => change("ratingTimeControl", e.target.value as LearningAnswers["ratingTimeControl"])}>{TIME_CONTROLS.map(v => <option key={v}>{v}</option>)}</select></label>
        </div>
      </fieldset>
      <Choices title="3. Main goals" options={GOALS} selected={answers.goals} onChange={v => change("goals", v as LearningAnswers["goals"])} />
      <Choices title="4. Weak areas" options={WEAKNESSES} selected={answers.weaknesses} onChange={v => {
        const next = v.includes("Not sure") && !answers.weaknesses.includes("Not sure") ? ["Not sure"] : v.filter(x => x !== "Not sure");
        change("weaknesses", next as LearningAnswers["weaknesses"]);
      }} />
      <fieldset className="rounded-xl border border-[#20382e]/15 p-4"><legend className="px-1 font-semibold">5. Playing habits</legend><div className="grid gap-4 sm:grid-cols-2">
        <label>How often do you play?<select className={inputClass} value={answers.playingFrequency} onChange={e => change("playingFrequency", e.target.value as LearningAnswers["playingFrequency"])}>{FREQUENCIES.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Usual time control<select className={inputClass} value={answers.usualTimeControl} onChange={e => change("usualTimeControl", e.target.value as LearningAnswers["usualTimeControl"])}>{TIME_CONTROLS.map(v => <option key={v}>{v}</option>)}</select></label>
      </div></fieldset>
      <fieldset className="rounded-xl border border-[#20382e]/15 p-4"><legend className="px-1 font-semibold">6–7. Study days and time</legend>
        <p className="mb-3 text-sm">Choose at least one day, with 5–240 minutes per selected day.</p>
        <div className="space-y-3">{DAYS.map(day => {
          const available = answers.availability.find(v => v.day === day);
          return <div key={day} className="flex flex-wrap items-center gap-3"><label className="flex min-w-32 items-center gap-2"><input type="checkbox" checked={!!available} onChange={e => change("availability", e.target.checked ? [...answers.availability, { day, minutes: 20 }].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)) : answers.availability.filter(v => v.day !== day))} />{day}</label>
            {available && <label className="flex items-center gap-2"><input aria-label={`${day} study minutes`} className="w-20 rounded-lg border bg-white p-2" type="number" min={5} max={240} step={1} value={Number.isNaN(available.minutes) ? "" : available.minutes} onChange={e => change("availability", answers.availability.map(v => v.day === day ? { ...v, minutes: e.target.value === "" ? NaN : Number(e.target.value) } : v))} />minutes</label>}
          </div>;
        })}</div><p className="mt-4 text-sm">Weekly study time: {Number.isFinite(minutes) ? minutes : "—"} minutes</p>
      </fieldset>
      <Choices title="8. Preferred activities" options={ACTIVITIES} selected={answers.activities} onChange={v => change("activities", v as LearningAnswers["activities"])} />
      <fieldset className="rounded-xl border border-[#20382e]/15 p-4"><legend className="px-1 font-semibold">9. Learning resources (optional)</legend>
        <p className="text-sm">Choose PDFs or learning materials you want to study.</p>
        {!resources.length && <p className="mt-2 text-sm">No books or learning materials available yet. You can describe other resources below.</p>}
        <div className="mt-3 space-y-3">{resources.map(r => <label key={`${r.kind}:${r.id}`} className="flex items-center gap-2"><input type="checkbox" checked={answers.resources.some(v => v.kind === r.kind && v.id === r.id)} onChange={e => change("resources", e.target.checked ? [...answers.resources, { kind: r.kind, id: r.id }] : answers.resources.filter(v => v.kind !== r.kind || v.id !== r.id))} />{r.title} ({r.kind === "book" ? "PDF" : "Learning material"})</label>)}</div>
        {answers.resources.some(r => !resources.some(v => v.kind === r.kind && v.id === r.id)) && <p className="mt-3 text-sm">Some previously selected resources are unavailable. <button type="button" className="underline" onClick={() => change("resources", answers.resources.filter(r => resources.some(v => v.kind === r.kind && v.id === r.id)))}>Remove unavailable resources</button></p>}
        <label className="mt-4 block">Other resources<textarea className={inputClass} rows={3} maxLength={1000} value={answers.otherResources} onChange={e => change("otherResources", e.target.value)} /></label>
      </fieldset>
      <label className="block font-semibold">10. Current focus (optional)<textarea className={inputClass} rows={3} maxLength={1000} value={answers.focus} onChange={e => change("focus", e.target.value)} /></label>
      <div className="flex flex-wrap gap-4"><button type="submit" className={buttonClass}>Review answers</button>{saved && <button type="button" className="underline" onClick={() => { setAnswers(saved.answers); go("saved"); }}>Cancel changes</button>}</div>
    </form> : <div className="mt-6 space-y-5">
      {stage === "saved" && <p role="status" className="rounded-lg bg-[#20382e]/10 p-3">Learning profile saved. You can update it anytime.</p>}
      <p className="rounded-xl border p-4">You have <strong>{minutes} minutes across {answers.availability.length} study {answers.availability.length === 1 ? "day" : "days"}</strong> each week. Your goals: {answers.goals.join(", ")}. You prefer {answers.activities.join(", ").toLowerCase()}.</p>
      <dl className="space-y-4">
        <div><dt className="font-semibold">Experience and rating</dt><dd>{answers.experience} · {answers.rating === null ? "Rating unknown" : `${answers.rating} on ${answers.ratingPlatform} (${answers.ratingTimeControl})`}</dd></div>
        <div><dt className="font-semibold">Weak areas</dt><dd>{answers.weaknesses.join(", ")}</dd></div>
        <div><dt className="font-semibold">Playing habits</dt><dd>{answers.playingFrequency} · {answers.usualTimeControl}</dd></div>
        <div><dt className="font-semibold">Study schedule</dt><dd><ul>{DAYS.flatMap(day => { const v = answers.availability.find(a => a.day === day); return v ? [<li key={day}>{day}: {v.minutes} minutes</li>] : []; })}</ul></dd></div>
        <div><dt className="font-semibold">Learning resources</dt><dd>{selectedResources.length ? selectedResources.map((r, i) => <p key={i}>{r?.title ?? "Unavailable resource"}{r && !resources.some(v => v.id === r.id && v.kind === r.kind) ? " (unavailable)" : ""}</p>) : "None selected"}{answers.otherResources && <p className="whitespace-pre-wrap">{answers.otherResources}</p>}</dd></div>
        <div><dt className="font-semibold">Current focus</dt><dd className="whitespace-pre-wrap">{answers.focus || "None specified"}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-4"><button type="button" disabled={pending} className="underline disabled:opacity-50" onClick={() => go("edit")}>{stage === "saved" ? "Edit profile" : "Back to editing"}</button>{stage === "review" && <button type="button" disabled={pending} className={buttonClass} onClick={save}>{pending ? "Saving…" : "Save learning profile"}</button>}</div>
      {saved && <p className="text-sm">Saved version {saved.revision}. Future plans can retain the answers used when they were created.</p>}
    </div>}
  </section>;
}
