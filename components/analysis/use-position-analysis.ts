"use client";
import { useEffect, useState } from "react";
import type { AnalysisEvent, AnalysisPosition, PositionResult, SearchPreset } from "@/lib/position-analysis/contract";

type SearchState = { key: string; result?: PositionResult; status: "searching" | "complete" | "error"; error?: string };
export function usePositionAnalysis(position: AnalysisPosition, preset: SearchPreset, enabled: boolean, revision: number) {
  const key = JSON.stringify({ ...position, preset, revision });
  const [state, setState] = useState<SearchState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController(); let disposed = false;
    const timer = setTimeout(async () => {
      setState({ key, status: "searching" });
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const input = JSON.parse(key); delete input.revision;
        const response = await fetch("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: abort.signal });
        if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message || "Analysis failed. Try again."); }
        if (!response.body) throw new Error("Analysis stream is unavailable. Try again.");
        reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let completed = false;
        while (!disposed) {
          const { value, done } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = buffer.split("\n"); buffer = lines.pop()!;
          if (buffer.length > 100000 || lines.some(line => line.length > 100000)) throw new Error("Analysis output exceeded its limit.");
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AnalysisEvent;
            if (disposed) break;
            if (event.type === "error") throw new Error(event.message);
            if (event.type !== "progress" && event.type !== "complete") throw new Error("Analysis returned an invalid update.");
            if (event.type === "complete") completed = true;
            setState({ key, result: event.result, status: completed ? "complete" : "searching" });
          }
          if (done) break;
        }
        if (!disposed && !completed) throw new Error("Analysis was interrupted. Try again.");
      } catch (cause) {
        if (!disposed) setState(previous => ({ key, result: previous?.key === key ? previous.result : undefined, status: "error", error: cause instanceof Error ? cause.message : "Analysis failed. Try again." }));
      } finally { await reader?.cancel().catch(() => {}); reader?.releaseLock(); }
    }, 400);
    return () => { disposed = true; clearTimeout(timer); abort.abort(); };
  }, [key, enabled]);
  const current = state?.key === key ? state : null;
  return { result: current?.result, error: current?.error,
    status: !enabled ? current?.status === "searching" ? "stopped" : current?.status ?? "idle" : current?.status ?? "searching" };
}
