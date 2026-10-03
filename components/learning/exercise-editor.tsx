"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReplayBoard } from "@/components/chess/replay-board";
import { contentSchema, sanLines, type LearningContent } from "@/lib/learning/content";
import { replay } from "@/lib/puzzles/sequence";
import { buttonClass, inputClass } from "./content-form";
const emptyFen = "8/8/8/8/8/8/8/8 w - - 0 1";
function place(fen: string, square: string, piece: string) {
  const parts = (fen || emptyFen).split(" ");
  const rows = parts[0].split("/").map(row => [...row].flatMap(char => /[1-8]/.test(char) ? Array(Number(char)).fill("") as string[] : [char]));
  if (rows.length !== 8 || rows.some(row => row.length !== 8)) throw new Error("Correct the FEN before placing pieces.");
  rows[8 - Number(square[1])][square.charCodeAt(0) - 97] = piece;
  parts[0] = rows.map(row => { let result = "", blanks = 0; for (const char of row) { if (!char) blanks++; else { if (blanks) result += blanks; blanks = 0; result += char; } } return result + (blanks || ""); }).join("/");
  return parts.join(" ");
}
export function ExerciseEditor({ chapterId, initial, books }: { chapterId: string; initial?: { id: string; revision: number; number: string; title: string; order: number; archived: boolean; status: string; content: LearningContent }; books: { id: string; title: string }[] }) {
  const router = useRouter(); const lock = useRef(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const [message, setMessage] = useState(initial?.status === "PUBLISHED" ? "Published. This revision is ready for practice." : initial?.status === "VALIDATED" ? "Validated. You can publish this exercise." : initial ? "Draft saved. Validate before publishing." : ""); const [content, setContent] = useState(initial?.content ?? contentSchema.parse({ fen: emptyFen }));
  const [savedId, setSavedId] = useState(initial?.id); const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [status, setStatus] = useState(initial?.status ?? "DRAFT"); const [dirty, setDirty] = useState(!initial);
  const [piece, setPiece] = useState("K"); const [square, setSquare] = useState("a1"); const [previewLines, setPreviewLines] = useState<string[][]>([]); const [preview, setPreview] = useState<string[]>([]); const [previewIndex, setPreviewIndex] = useState(0);
  function change(patch: Partial<LearningContent>) { setContent({ ...content, ...patch }); setDirty(true); setPreview([]); setMessage(""); }
  function fenPart(index: number, value: string) { const parts = (content.fen || emptyFen).split(" "); parts[index] = value || "-"; change({ fen: parts.join(" "), ...(index === 1 ? { solver: value === "w" ? "WHITE" : "BLACK" } : {}) }); }
  function put(square: string) { try { change({ fen: place(content.fen, square, piece) }); setError(""); } catch (error) { setError((error as Error).message); } }
  let displayFen = content.fen || emptyFen;
  try { if (preview.length) displayFen = replay(content.fen, preview.slice(0, previewIndex)).board.fen(); } catch { /* incomplete draft */ }
  const diagramRows = displayFen.split(" ")[0].split("/");
  const validDiagram = diagramRows.length === 8 && diagramRows.every(row => /^[1-8prnbqkPRNBQK]+$/.test(row) && [...row].reduce((count,char) => count + (/[1-8]/.test(char) ? Number(char) : 1), 0) === 8);
  if (!validDiagram) displayFen = emptyFen;
  async function send(body: object) {
    const response = await fetch("/api/learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? "Could not save exercise."); return result;
  }
  async function action(kind: "validate" | "publish") {
    if (!initial?.id || !savedId || dirty || lock.current) return; lock.current = true; setPending(true); setError("");
    try { await send({ kind, id: savedId, expectedRevision: revision }); setRevision(revision + 1); setStatus(kind === "validate" ? "VALIDATED" : "PUBLISHED");
      setMessage(kind === "validate" ? "Validated. You can publish this exercise." : "Published. This revision is ready for practice."); if (kind === "publish") router.refresh();
    } catch (error) { setError((error as Error).message); } finally { lock.current = false; setPending(false); }
  }
  return <form className="mt-6 grid gap-6 lg:grid-cols-2" onSubmit={async event => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    try { const result = await send({ kind: "exercise", id: savedId, expectedRevision: revision, chapterId, number: data.get("number"), title: data.get("title"), order: Number(data.get("order")), archived: data.get("archived") === "on", content });
      setSavedId(result.id); setRevision(savedId ? revision + 1 : 0); setDirty(false); setStatus("DRAFT"); setMessage("Draft saved. Validate before publishing.");
      if (!savedId) router.replace(`/learning/exercises/${result.id}/edit`); else router.refresh();
    } catch (error) { setError((error as Error).message); } finally { lock.current = false; setPending(false); }
  }}>
    <fieldset disabled={pending || (!!savedId && !initial?.id)} className="min-w-0 space-y-4">
      <legend className="font-semibold">Position</legend>
      <ReplayBoard fen={displayFen} userColor={content.solver} positionLabel="Exercise editor" onSquareClick={!preview.length && !pending ? put : undefined} />
      {!validDiagram && <p className="text-sm">The diagram cannot be displayed yet. Correct the board portion of the FEN; your draft input is preserved.</p>}
      <p className="text-sm">Choose a piece and click its square. Use Remove to clear a square.</p>
      <label className="block text-sm">Piece to place<select className={inputClass} value={piece} onChange={event => setPiece(event.target.value)}>
        <option value="">Remove</option>{["K","Q","R","B","N","P","k","q","r","b","n","p"].map(p => <option key={p} value={p}>{p === p.toUpperCase() ? "White" : "Black"} {({k:"King",q:"Queen",r:"Rook",b:"Bishop",n:"Knight",p:"Pawn"} as Record<string,string>)[p.toLowerCase()]}</option>)}
      </select></label>
      <div className="flex gap-2 items-end"><label className="text-sm">Square<input className={inputClass} value={square} maxLength={2} onChange={event => setSquare(event.target.value.toLowerCase())} /></label><button type="button" className={buttonClass} onClick={() => /^[a-h][1-8]$/.test(square) ? put(square) : setError("Enter a square such as a1.")}>Place piece</button></div>
      <label className="block text-sm">Full FEN<textarea className={inputClass} value={content.fen} onChange={event => change({ fen: event.target.value })} maxLength={200} /></label>
      <label className="block text-sm">Side to move<select className={inputClass} value={content.solver} onChange={event => fenPart(1, event.target.value === "WHITE" ? "w" : "b")}><option>WHITE</option><option>BLACK</option></select></label>
      <label className="block text-sm">Castling rights<input className={inputClass} value={content.fen.split(" ")[2] ?? "-"} onChange={event => fenPart(2,event.target.value)} maxLength={4} /></label>
      <label className="block text-sm">En passant square<input className={inputClass} value={content.fen.split(" ")[3] ?? "-"} onChange={event => fenPart(3,event.target.value)} maxLength={2} /></label>
      <button type="button" className={buttonClass} onClick={() => { try { const lines = sanLines(content); setPreviewLines(lines.map(line => line.moves)); setPreview(lines[0].moves); setPreviewIndex(0); setError(""); } catch (error) { setError((error as Error).message); } }}>Preview first solution</button>
      {preview.length > 0 && <label className="block text-sm">Solution branch<select className={inputClass} onChange={event => { setPreview(previewLines[Number(event.target.value)]); setPreviewIndex(0); }}>{previewLines.map((line,index) => <option key={index} value={index}>Branch {index + 1}: {replay(content.fen,line).history.map(move => move.san).join(" ")}</option>)}</select></label>}
      {preview.length > 0 && <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => setPreviewIndex(Math.max(0,previewIndex-1))}>Previous move</button><button type="button" className={buttonClass} onClick={() => setPreviewIndex(Math.min(preview.length,previewIndex+1))}>Next move</button><button type="button" className={buttonClass} onClick={() => setPreview([])}>Return to editing</button><p className="text-sm">{replay(content.fen, preview.slice(0,previewIndex)).history.map(m => m.san).join(" → ") || "Starting position"}</p></div>}
    </fieldset>
    <fieldset disabled={pending || (!!savedId && !initial?.id)} className="space-y-4">
      <legend className="font-semibold">Exercise details</legend>
      <label className="block text-sm">Exercise number<input className={inputClass} name="number" defaultValue={initial?.number} required maxLength={200} onChange={() => setDirty(true)} /></label>
      <label className="block text-sm">Title<input className={inputClass} name="title" defaultValue={initial?.title} required maxLength={200} onChange={() => setDirty(true)} /></label>
      <label className="block text-sm">Order<input className={inputClass} name="order" type="number" min={0} max={100000} defaultValue={initial?.order ?? 0} required onChange={() => setDirty(true)} /></label>
      <label className="block text-sm">Exercise type<select className={inputClass} value={content.type} onChange={event => change({ type: event.target.value as LearningContent["type"] })}><option value="MOVE">Move puzzle</option><option value="MISSING_PIECE">Missing Piece (draft only)</option></select></label>
      <label className="block text-sm">Prompt<textarea className={inputClass} value={content.prompt} maxLength={2000} onChange={event => change({ prompt: event.target.value })} /></label>
      <label className="block text-sm">Objective<select className={inputClass} value={content.objective} onChange={event => change({ objective: event.target.value as LearningContent["objective"] })}><option value="MATE">Force mate within the move bound</option><option value="SEQUENCE">Authored tactical sequence</option></select></label>
      {content.objective === "MATE" && <label className="block text-sm">Mate in<input className={inputClass} type="number" min={1} max={4} value={content.mateIn} onChange={event => change({ mateIn: Number(event.target.value) })} /></label>}
      <label className="block text-sm">Published solution (SAN, one branch per line)<textarea className={inputClass} value={content.solutionText} maxLength={10000} placeholder="Rxa6#" onChange={event => change({ solutionText: event.target.value })} /></label>
      {(["hint","explanation","diagramPage","answerPage"] as const).map(key => <label key={key} className="block text-sm">{({ hint:"Hint", explanation:"Explanation", diagramPage:"Printed diagram page", answerPage:"Printed answer page" })[key]}<textarea className={inputClass} value={content[key]} maxLength={key === "explanation" ? 5000 : key === "hint" ? 2000 : 80} onChange={event => change({ [key]: event.target.value })} /></label>)}
      <label className="block text-sm">Source PDF (optional)<select className={inputClass} value={content.pdfId} onChange={event => change({ pdfId: event.target.value })}><option value="">No linked PDF</option>{books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
      {content.pdfId && <Link className="inline-block text-sm underline" href={`/api/books/${content.pdfId}/file`}>Download source PDF</Link>}
      <label className="block text-sm">PDF diagram page index<input className={inputClass} type="number" min={1} max={10000} value={content.pdfPage ?? ""} onChange={event => change({ pdfPage: event.target.value ? Number(event.target.value) : null })} /></label>
      {initial && <label className="block text-sm"><input type="checkbox" name="archived" defaultChecked={initial.archived} onChange={() => setDirty(true)} /> Archive exercise (preserves history)</label>}
      <p className="text-sm">Status: {dirty ? "Unsaved changes" : status}. Changing the answer creates a new published revision; previous completion stays in history.</p>
      <div className="flex flex-wrap gap-2"><button className={buttonClass}>Save draft</button><button type="button" className={buttonClass} disabled={dirty || !savedId || !initial?.id} onClick={() => void action("validate")}>Validate</button><button type="button" className={buttonClass} disabled={dirty || !savedId || !initial?.id || status !== "VALIDATED"} onClick={() => void action("publish")}>Publish</button></div>
      {message && <p role="status" aria-label="Exercise authoring status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    </fieldset>
  </form>;
}
