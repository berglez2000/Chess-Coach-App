"use client";

import { useActionState, useState } from "react";
import { MAX_PGN_LENGTH } from "@/lib/validation/import-game";
import type { ImportAction, ImportState } from "@/types/import";

export function ImportForm({ importAction }: { importAction: ImportAction }) {
  const [userColor, setUserColor] = useState("");
  const [pgn, setPgn] = useState("");
  const [state, action, pending] = useActionState<ImportState, FormData>(
    async (_previous, data) => {
      if (!String(data.get("pgn") ?? "").trim()) {
        return { status: "error", message: "Check the highlighted fields.", fields: { pgn: "Paste a PGN containing at least one move." } };
      }
      try {
        return await importAction(data);
      } catch {
        return { status: "error", message: "Could not reach the server. Your input is still here; please try again." };
      }
    },
    { status: "idle" },
  );
  const errors = state.status === "error" ? state.fields : undefined;
  const result = state.status === "success" && state.game.pgn === pgn && state.userColor === userColor ? state : null;
  const inputClass = "mt-2 w-full rounded-lg border border-[#20382e]/30 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#20382e] disabled:opacity-60";

  return (
    <>
      <form action={action} onReset={(event) => event.preventDefault()}
        className="mt-8 space-y-6" aria-busy={pending}>
        <div>
          <label htmlFor="user-color" className="font-semibold">Your color</label>
          <select id="user-color" name="userColor" required value={userColor}
            onChange={(event) => setUserColor(event.target.value)} disabled={pending}
            aria-invalid={Boolean(errors?.userColor)} aria-describedby={errors?.userColor ? "color-error" : undefined}
            className={inputClass}>
            <option value="" disabled>Select your color</option>
            <option value="WHITE">White</option>
            <option value="BLACK">Black</option>
          </select>
          {errors?.userColor && <p id="color-error" className="mt-2 text-sm text-red-800">{errors.userColor}</p>}
        </div>
        <div>
          <label htmlFor="pgn" className="font-semibold">Game PGN</label>
          <p id="pgn-help" className="mt-1 text-sm text-[#465c50]">Paste one game, including its headers when available.</p>
          <textarea id="pgn" name="pgn" required maxLength={MAX_PGN_LENGTH} rows={10}
            value={pgn} onChange={(event) => setPgn(event.target.value)} disabled={pending}
            spellCheck={false} placeholder={'[White "Your name"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 *'}
            aria-invalid={Boolean(errors?.pgn)} aria-describedby={`pgn-help${errors?.pgn ? " pgn-error" : ""}`}
            className={`${inputClass} font-mono text-sm`} />
          {errors?.pgn && <p id="pgn-error" className="mt-2 text-sm text-red-800">{errors.pgn}</p>}
        </div>
        <button type="submit" disabled={pending}
          className="rounded-lg bg-[#20382e] px-6 py-3 font-semibold text-white hover:bg-[#304e40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20382e] disabled:cursor-wait disabled:opacity-60">
          {pending ? "Importing…" : "Import"}
        </button>
        {pending && <p role="status" className="text-sm">Checking your game…</p>}
        {!pending && state.status === "error" && <p role="alert" className="text-red-800">{state.message}</p>}
      </form>
      {!pending && result && (
        <section role="status" className="mt-8 rounded-lg border border-[#20382e]/20 bg-white p-5">
          <h2 className="font-semibold">Game imported</h2>
          <p className="mt-2">{result.game.metadata.whiteName ?? "White"} vs. {result.game.metadata.blackName ?? "Black"} · {result.game.moves.length} half-moves · You played {result.userColor === "WHITE" ? "White" : "Black"}.</p>
          <p className="mt-2 text-sm text-[#465c50]">Your PGN is valid. Board review is coming next. This preview is not saved; refreshing will clear it.</p>
        </section>
      )}
    </>
  );
}
