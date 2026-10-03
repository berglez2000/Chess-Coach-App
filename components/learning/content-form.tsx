"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export const buttonClass = "rounded-lg border border-[#20382e]/30 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-40";
export const inputClass = "mt-1 block w-full rounded-lg border border-[#20382e]/30 bg-white p-2";
export function ContentForm({ kind, initial, label }: { kind: "material" | "chapter" | "sample"; initial?: Record<string, string | number | boolean>; label: string }) {
  const router = useRouter(); const lock = useRef(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  return <form className="mt-4 space-y-3" onSubmit={async event => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setPending(true); setError("");
    const fields = new FormData(event.currentTarget);
    const body = { ...initial, kind, ...(kind !== "sample" ? { title: fields.get("title"), archived: fields.get("archived") === "on" } : {}),
      ...(kind === "material" ? { edition: fields.get("edition") } : kind === "chapter" ? { order: Number(fields.get("order")) } : {}) };
    try { const response = await fetch("/api/learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? "Could not save content.");
      if (kind === "sample" || !initial?.id) router.push(`/learning/${result.materialId}`); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Connection lost. Reload before retrying."); }
    finally { lock.current = false; setPending(false); }
  }}>
    {kind !== "sample" && <>
      <label className="block text-sm">Title<input className={inputClass} name="title" defaultValue={String(initial?.title ?? "")} required maxLength={200} disabled={pending} /></label>
      {kind === "material" ? <label className="block text-sm">Edition or source note<input className={inputClass} name="edition" defaultValue={String(initial?.edition ?? "")} maxLength={200} disabled={pending} /></label> :
        <label className="block text-sm">Order<input className={inputClass} name="order" type="number" min={0} max={100000} defaultValue={Number(initial?.order ?? 0)} required disabled={pending} /></label>}
      {initial?.id && <label className="block text-sm"><input name="archived" type="checkbox" disabled={pending} defaultChecked={!!initial?.archived} /> Archive (preserves exercise history)</label>}
    </>}
    <button className={buttonClass} disabled={pending}>{pending ? "Saving…" : label}</button>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </form>;
}
