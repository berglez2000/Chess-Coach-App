"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DAYS, type SavedProfile } from "@/lib/learning-profile/contract";
import { PROVIDERS, type CoachingSettings } from "@/lib/coaching/providers";
import { GENERIC_INSTRUCTIONS, PLAN_ACTIVITIES, PlanError, validatePlan, type PlanState, type PlanAction, type PlanDefinition, type PlanDraft, type AcceptedPlan, type PlanResource } from "@/lib/weekly-plan/contract";
import { Icon, type IconName } from "@/components/ui/icon";
import shared from "@/components/ui/simple-page.module.css";
import styles from "./weekly-plan.module.css";
const buttonClass = shared.primary;
const inputClass = shared.input;
const activityIcons: Record<PlanDefinition["sessions"][number]["activity"], IconName> = {
  Tactics: "puzzles", "Own-game puzzles": "puzzles", Lessons: "learning", Endgames: "learning", "Game review": "games", Reading: "books", Playing: "games",
};
function ResourceLink({ resource, available }: { resource: PlanResource; available: boolean }) {
  return available ? <Link href={resource.href} className={styles.resourceLink}>{resource.title}</Link> : <span>{resource.title} (currently unavailable)</span>;
}
function PlanSummary({ plan, availableKeys }: { plan: PlanDraft | AcceptedPlan; availableKeys: string[] }) {
  return <div className={styles.summary}>
    <div className={styles.schedule}>
    {DAYS.filter(day => plan.definition.sessions.some(s => s.day === day)).map(day => <section key={day} className={styles.day}>
      <h3 className={styles.dayHeader}><span>{day}</span><span className={styles.duration}>{plan.definition.sessions.filter(s => s.day === day).reduce((n, s) => n + s.minutes, 0)} minutes</span></h3>
      <ol className={styles.sessions}>{plan.definition.sessions.filter(s => s.day === day).map((session, index) => {
        const resource = plan.inputs.resources.find(r => r.key === session.resourceKey);
        return <li key={index} className={styles.session}><span className={styles.activityIcon}><Icon name={activityIcons[session.activity]} /></span><div>
          <p className={styles.activity}>{session.activity}<span>{session.minutes} min</span></p>
          <p className={styles.resource}>{resource ? <ResourceLink resource={resource} available={availableKeys.includes(resource.key)} /> : "Generic study · choose your own resource"}</p>
          <p className={styles.instruction}>{resource ? session.activity === "Reading" ? "Read from this resource and note one useful idea." : "Use this resource for the session; review what you learned afterward." : GENERIC_INSTRUCTIONS[session.activity]}</p>
          </div>
        </li>;
      })}</ol>
    </section>)}
    </div>
    <details className={styles.details}><summary>Inputs and provider used</summary>
      <p className="mt-3">{PROVIDERS[plan.provider].label} · {plan.model}</p>
      <p className="mt-2">Learning profile version {plan.inputs.profile.revision}. Goals: {plan.inputs.profile.answers.goals.join(", ")}. Weak areas: {plan.inputs.profile.answers.weaknesses.join(", ")}. Preferred activities: {plan.inputs.profile.answers.activities.join(", ")}.</p>
      <p className="mt-2">Experience: {plan.inputs.profile.answers.experience}. Rating: {plan.inputs.profile.answers.rating ?? "Unknown"}{plan.inputs.profile.answers.rating !== null && ` (${plan.inputs.profile.answers.ratingPlatform}, ${plan.inputs.profile.answers.ratingTimeControl})`}.</p>
      <p className="mt-2">Playing habits: {plan.inputs.profile.answers.playingFrequency} · {plan.inputs.profile.answers.usualTimeControl}.</p>
      <p className="mt-2 whitespace-pre-wrap">Current focus: {plan.inputs.profile.answers.focus || "None specified"}. Other resources: {plan.inputs.profile.answers.otherResources || "None specified"}.</p>
      <p className="mt-2">{plan.inputs.resources.length} available resource options were considered{plan.inputs.omittedResources ? `; ${plan.inputs.omittedResources} more were outside the bounded selection` : ""}.</p>
      <p className="mt-2">Selected resources: {plan.inputs.profile.resourceTitles.map(r => r.title).join(", ") || "None"}.</p>
    </details>
  </div>;
}
export function WeeklyPlanEditor({ initial, profile, settings, availableKeys: initialKeys }: { initial: PlanState; profile: SavedProfile | null; settings: CoachingSettings; availableKeys: string[] }) {
  const [state, setState] = useState(initial);
  const [definition, setDefinition] = useState<PlanDefinition | null>(initial.draft?.definition ?? null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [availableKeys, setAvailableKeys] = useState(initialKeys);
  const [pendingAction, setPendingAction] = useState<PlanAction | null>(null);
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const running = state.generation?.status === "RUNNING";
  const acceptedMatches = state.draft && state.accepted && state.draft.id === state.accepted.generationId && state.draft.revision === state.accepted.draftRevision;
  const draft = state.draft;
  function update(next: PlanState, keys?: string[]) {
    setState(next); if (keys) setAvailableKeys(keys);
  }
  async function refresh() {
    if (lock.current) return;
    lock.current = true; setPending(true); setError("");
    try {
      const response = await fetch("/api/learning/plan", { cache: "no-store" }); const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not refresh your plan.");
      update(body.state, body.availableKeys); setEditing(false); setDefinition(body.state.draft?.definition ?? null); setPendingAction(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh your plan."); }
    finally { lock.current = false; setPending(false); }
  }
  // Polling only reads job status; it never initiates or retries a provider call.
  useEffect(() => {
    if (state.generation?.status !== "RUNNING") return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (lock.current) return;
      try {
        const response = await fetch("/api/learning/plan", { cache: "no-store" }); const body = await response.json();
        if (stopped || !response.ok) return;
        update(body.state, body.availableKeys);
        if (body.state.generation?.status !== "RUNNING") { setDefinition(body.state.draft?.definition ?? null); setPendingAction(null); }
      } catch { /* The explicit refresh button keeps recovery available. */ }
    }, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, [state.generation?.status]);
  async function act(action: PlanAction) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(""); setNotice(""); setPendingAction(action);
    try {
      const response = await fetch("/api/learning/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      const body = await response.json();
      if (!response.ok) { setPendingAction(null); throw new Error(body.error?.message ?? "Could not update your plan."); }
      update(body.state, body.availableKeys); setDefinition(body.state.draft?.definition ?? null); setEditing(false); setPendingAction(null);
      setNotice(action.action === "EDIT" ? "Proposal changes saved. Accept it when you are ready." : action.action === "ACCEPT" ? "Weekly plan accepted." : body.state.generation?.status === "READY" ? "New proposal ready to review." : "");
      requestAnimationFrame(() => heading.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The response was lost. Refresh status or retry the same request."); }
    finally { lock.current = false; setPending(false); }
  }
  function generate() {
    return act({ action: "GENERATE", expectedRevision: state.revision, requestId: crypto.randomUUID() });
  }
  const total = profile?.answers.availability.reduce((n, day) => n + day.minutes, 0) ?? 0;
  return <div className={styles.editor}>
    <section className={styles.setup} aria-labelledby="setup-title">
      <div className={styles.cardHeading}><span className={styles.activityIcon}><Icon name="plan" size={22} /></span><div><h2 id="setup-title">Build your study routine</h2><p>Generate a proposal, make it yours, then accept it.</p></div></div>
      {profile && <dl className={styles.overview}><div><dt>Weekly study time</dt><dd>{total}<span>minutes</span></dd></div><div><dt>Study days</dt><dd>{profile.answers.availability.length}<span>per week</span></dd></div><div><dt>Your focus</dt><dd className={styles.focus}>{profile.answers.goals.join(" · ") || "Explore and improve"}</dd></div></dl>}
      {profile ? <p>Your routine follows your saved goals and availability. <Link href="/learning/profile" className={shared.link}>Edit learning profile</Link></p>
        : <p>Save your <Link href="/learning/profile" className={shared.link}>learning profile</Link> before generating a plan.</p>}
      <p className={styles.hint}>Generate with {PROVIDERS[settings.provider].label} · {PROVIDERS[settings.provider].model}. <Link href="/settings" className={shared.link}>Change provider</Link></p>
      <p className={styles.hint}>Generation sends your saved profile answers and resource titles to this provider and may incur API charges. Each explicit request is limited to 60 seconds and 4,096 output tokens, with no automatic paid retries. Loading this page makes no AI calls.</p>
      {!settings.available[settings.provider] && <p className="mt-3">The selected provider needs a server API key. Choose a configured provider in Settings.</p>}
      {state.accepted && <p className={styles.hint}>Generating a new proposal keeps your accepted plan until you explicitly accept its replacement.</p>}
      <div className={styles.actions}><button type="button" className={buttonClass} disabled={!profile || !settings.available[settings.provider] || pending || running || editing || !!pendingAction} onClick={() => void generate()}>{state.draft || state.accepted ? "Generate new proposal" : "Generate weekly plan"}</button>
        <button type="button" className={styles.secondary} disabled={pending || editing} onClick={() => void refresh()}>Refresh plan status</button></div>
      {editing && <p className={styles.hint}>Save or cancel your edits before generating another proposal.</p>}
      {(pending && pendingAction?.action === "GENERATE" || running) && <p role="status" aria-label="Plan generation status" className="mt-3">Generating your plan… Saved plans remain available.</p>}
    </section>
    {error && <p role="alert" aria-label="Weekly plan feedback" className={shared.error}>{error}</p>}
    {state.generation?.error && <p role="alert" aria-label="Plan generation feedback" className={shared.error}>{state.generation.error}</p>}
    {error && pendingAction && <button type="button" className={buttonClass} disabled={pending} onClick={() => pendingAction && void act(pendingAction)}>Retry same request</button>}
    {notice && <p role="status" aria-label="Weekly plan feedback" className={shared.success}>{notice}</p>}
    <h2 ref={heading} tabIndex={-1} className={styles.sectionTitle}>{state.accepted ? "Your accepted weekly template" : "Your weekly template"}</h2>
    {state.accepted ? <section aria-label="Accepted weekly plan" className={styles.plan}>
      <h3 className={styles.planTitle}>{state.accepted.definition.title}</h3><p className={styles.hint}>Accepted version {state.accepted.version}</p>
      {profile && state.accepted.inputs.profile.id !== profile.id && <p className={styles.hint}>Your learning profile has changed since this plan was created. Generate a new proposal to use your latest goals and availability.</p>}
      <PlanSummary plan={state.accepted} availableKeys={availableKeys} />
      {acceptedMatches && !editing && <button type="button" className={styles.editAccepted} disabled={pending || running} onClick={() => { setDefinition(draft!.definition); setEditing(true); setError(""); }}>Edit accepted plan</button>}
    </section> : <div className={styles.empty}><span className={styles.emptyIcon}><Icon name="plan" size={26} /></span><h3>Your routine starts here</h3><p>You have no accepted plan yet. A generated proposal is saved separately until you accept it.</p></div>}
    {draft && (!acceptedMatches || editing) && <section aria-label="Weekly plan proposal" className={styles.plan}>
      <h2 className={styles.planTitle}>{editing ? "Edit proposal" : "Review proposal"}</h2>
      <p className={styles.hint}>Uses learning profile version {draft.inputs.profile.revision}. Keep each day’s total equal to its saved time budget.</p>
      {profile && draft.inputs.profile.id !== profile.id && <p className={styles.hint}>This proposal uses an earlier profile. Regenerate to use your current answers.</p>}
      {editing && definition ? <form className={styles.form} onSubmit={e => {
        e.preventDefault();
        try { validatePlan(definition, draft.inputs); } catch (cause) { setError(cause instanceof PlanError ? cause.message : "Check your session values."); return; }
        void act({ action: "EDIT", draftId: draft.id, draftRevision: draft.revision, expectedRevision: state.revision, definition });
      }}><fieldset disabled={pending || running} className={styles.fields}>
        <label className={shared.label}>Plan title<input className={inputClass} required maxLength={120} value={definition.title} onChange={e => setDefinition({ ...definition, title: e.target.value })} /></label>
        {definition.sessions.map((session, index) => <fieldset key={index} className={styles.sessionEditor}>
          <legend className={styles.legend}>Session {index + 1}</legend>
          <div className={styles.fieldGrid}>
            <label>Day<select aria-label={`Session ${index + 1} day`} className={inputClass} value={session.day} onChange={e => setDefinition({ ...definition, sessions: definition.sessions.map((s, i) => i === index ? { ...s, day: e.target.value as typeof s.day } : s) })}>{DAYS.filter(d => draft.inputs.profile.answers.availability.some(a => a.day === d)).map(d => <option key={d}>{d}</option>)}</select></label>
            <label>Minutes<input aria-label={`Session ${index + 1} minutes`} className={inputClass} type="number" required min={5} max={240} step={1} value={session.minutes || ""} onChange={e => setDefinition({ ...definition, sessions: definition.sessions.map((s, i) => i === index ? { ...s, minutes: Number(e.target.value) } : s) })} /></label>
            <label>Activity<select aria-label={`Session ${index + 1} activity`} className={inputClass} value={session.activity} onChange={e => setDefinition({ ...definition, sessions: definition.sessions.map((s, i) => i === index ? { ...s, activity: e.target.value as typeof s.activity, resourceKey: null } : s) })}>{PLAN_ACTIVITIES.map(a => <option key={a}>{a}</option>)}</select></label>
          </div>
          <label className={styles.resourceLabel}>Resource<select aria-label={`Session ${index + 1} resource`} className={inputClass} value={session.resourceKey ?? ""} onChange={e => setDefinition({ ...definition, sessions: definition.sessions.map((s, i) => i === index ? { ...s, resourceKey: e.target.value || null } : s) })}>
            <option value="">Generic study · choose your own resource</option>{draft.inputs.resources.filter(r => r.activities.includes(session.activity)).map(r => <option key={r.key} value={r.key} disabled={!availableKeys.includes(r.key)}>{r.title}{!availableKeys.includes(r.key) ? " (unavailable)" : ""}</option>)}
          </select></label>
          <button type="button" className={styles.remove} disabled={definition.sessions.length <= 1} onClick={() => setDefinition({ ...definition, sessions: definition.sessions.filter((_, i) => i !== index) })}>Remove session {index + 1}</button>
        </fieldset>)}
        <button type="button" className={shared.link} disabled={definition.sessions.length >= 28} onClick={() => setDefinition({ ...definition, sessions: [...definition.sessions, { day: draft.inputs.profile.answers.availability[0].day, minutes: 5, activity: "Tactics", resourceKey: null }] })}>Add session</button>
        <ul className={styles.budgets}>{draft.inputs.profile.answers.availability.map(day => <li key={day.day}>{day.day}: {definition.sessions.filter(s => s.day === day.day).reduce((n, s) => n + s.minutes, 0)} / {day.minutes} minutes</li>)}</ul>
        <div className={styles.actions}><button type="submit" className={buttonClass}>Save proposal changes</button><button type="button" className={shared.link} onClick={() => { setEditing(false); setDefinition(draft.definition); setError(""); }}>Cancel edits</button></div>
      </fieldset></form> : <>
        <PlanSummary plan={draft} availableKeys={availableKeys} />
        <div className={styles.actions}><button type="button" className={styles.secondary} disabled={pending || running} onClick={() => { setDefinition(draft.definition); setEditing(true); setError(""); }}>Edit proposal</button>
          <button type="button" className={buttonClass} disabled={pending || running} onClick={() => void act({ action: "ACCEPT", draftId: draft.id, draftRevision: draft.revision, expectedRevision: state.revision })}>Accept weekly plan</button></div>
      </>}
    </section>}
  </div>;
}
