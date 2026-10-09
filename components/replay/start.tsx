"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function StartReplay({ gameId, disabled = false }: { gameId?: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const submitted = useRef(false);
  async function start() {
    if (submitted.current) return;
    submitted.current = true; setPending(true); setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/replay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestId.current, gameId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not start practice.");
      router.push(`/replay/${body.session.id}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Connection lost. Try again."); submitted.current = false; setPending(false); }
  }
  return <div><button disabled={disabled || pending} onClick={() => void start()} className="mt-3 rounded-lg bg-[#20382e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Opening practice…" : "Start practice"}</button>{error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}</div>;
}
