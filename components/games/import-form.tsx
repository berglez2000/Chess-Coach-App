"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestGameImport } from "@/lib/games/import-request";
import { MAX_PGN_LENGTH } from "@/lib/validation/import-game";
import type { ImportAction, ImportState } from "@/types/import";
import { Icon } from "@/components/ui/icon";
import shared from "@/components/ui/simple-page.module.css";
import styles from "./import-form.module.css";

export function ImportForm({ importAction = requestGameImport }: { importAction?: ImportAction }) {
  const router = useRouter();
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
  useEffect(() => {
    if (state.status === "success") router.push(`/games/${state.gameId}?analyze=1`);
  }, [state, router]);
  const inputClass = shared.input;

  return (
    <>
      <form action={action} onReset={(event) => event.preventDefault()}
        className={styles.form} aria-busy={pending}>
        <div>
          <label htmlFor="user-color" className={shared.label}>Your color</label>
          <p id="color-help" className={styles.hint}>Which side did you play in this game?</p>
          <select id="user-color" name="userColor" required value={userColor}
            onChange={(event) => setUserColor(event.target.value)} disabled={pending}
            aria-invalid={Boolean(errors?.userColor)} aria-describedby={`color-help${errors?.userColor ? " color-error" : ""}`}
            className={`${inputClass} ${styles.colorSelect}`}>
            <option value="" disabled>Select your color</option>
            <option value="WHITE">White</option>
            <option value="BLACK">Black</option>
          </select>
          {errors?.userColor && <p id="color-error" className={styles.fieldError}>{errors.userColor}</p>}
        </div>
        <div>
          <label htmlFor="pgn" className={shared.label}>Game PGN</label>
          <p id="pgn-help" className={styles.hint}>Paste one game, including its headers when available.</p>
          <textarea id="pgn" name="pgn" required maxLength={MAX_PGN_LENGTH} rows={10}
            value={pgn} onChange={(event) => setPgn(event.target.value)} disabled={pending}
            spellCheck={false} placeholder={'[White "Your name"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 *'}
            aria-invalid={Boolean(errors?.pgn)} aria-describedby={`pgn-help${errors?.pgn ? " pgn-error" : ""}`}
            className={`${inputClass} ${styles.pgn}`} />
          {errors?.pgn && <p id="pgn-error" className={styles.fieldError}>{errors.pgn}</p>}
        </div>
        <div className={styles.footer}><button type="submit" disabled={pending}
          className={shared.primary}>
          <Icon name="import" />
          {pending ? "Importing…" : "Import and Analyze"}
        </button><p className={styles.hint}>You can revisit this game in your library.</p></div>
        {pending && <p role="status" className={shared.notice}>Checking and saving your game…</p>}
        {!pending && state.status === "error" && <p role="alert" className={shared.error}>{state.message}</p>}
      </form>
      {!pending && state.status === "success" && <p role="status" className={`${shared.success} ${styles.success}`}>Game saved. Opening review to start analysis…</p>}
    </>
  );
}
