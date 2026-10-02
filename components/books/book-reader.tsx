"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { PDF_WORKER_URL, type BookAction, type ReaderBook } from "@/lib/books/contract";

export type ReaderAction = BookAction extends infer A ? A extends BookAction ? Omit<A, "revision"> : never : never;
export function BookReader({ book, busy, onChange, onBack }: { book: ReaderBook; busy: boolean; onChange: (action: ReaderAction) => Promise<void>; onBack: () => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState<{ pdf: PDFDocumentProxy; page: number; width: number; zoom: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(600);
  const [retry, setRetry] = useState(0);
  const [marking, setMarking] = useState(false);
  const [size, setSize] = useState({ width: 600, height: 800 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const ready = rendered?.pdf === pdf && rendered?.page === book.currentPage && rendered?.width === width && rendered?.zoom === zoom;
  const disabled = busy || !ready;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(200, element.clientWidth - 16)));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/books/${book.id}/file`, { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error("Could not open this PDF. Check your session and reopen the book.");
        const data = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import("pdfjs-dist");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
        task = pdfjs.getDocument({ data, useSystemFonts: true });
        const document = await task.promise;
        if (active) setPdf(document);
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Could not open this PDF."); }
    })();
    return () => { active = false; abort.abort(); void task?.destroy(); };
  }, [book.id, retry]);
  useEffect(() => {
    let active = true;
    let task: RenderTask | undefined;
    if (!pdf) return;
    void (async () => {
      try {
        const page = await pdf.getPage(book.currentPage);
        if (active) setError("");
        if (!active || !canvas.current) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(width, 900) / base.width * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (viewport.width * viewport.height)));
        const target = canvas.current;
        target.width = Math.ceil(viewport.width * ratio); target.height = Math.ceil(viewport.height * ratio);
        setSize({ width: viewport.width, height: viewport.height });
        task = page.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
        if (active) setRendered({ pdf, page: book.currentPage, width, zoom });
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Could not render this page."); }
    })();
    return () => { active = false; task?.cancel(); };
  }, [pdf, book.currentPage, width, zoom]);

  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && (event.target.closest("input, textarea, select, button, a") || event.target.isContentEditable))) return;
      if (event.key === "Escape" && !busy) onBack();
      if (disabled) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); const page = book.currentPage + (event.key === "ArrowRight" ? 1 : -1);
        if (page > 0 && page <= book.totalPages) void onChange({ action: "page", page });
      }
    }
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [book.currentPage, book.totalPages, busy, disabled, onBack, onChange]);
  const marks = book.marks.filter(mark => mark.page === book.currentPage);
  return <section aria-label="Book reader">
    <button type="button" disabled={busy} className="underline" onClick={onBack}>Back to books</button>
    <h1 className="mt-4 break-words text-2xl font-semibold">{book.name}</h1>
    <p className="mt-2 text-sm">Reading position and checkmarks save to your account. Use Left/Right arrows to turn pages; Escape returns to your library.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#20382e]/15 bg-white p-3">
      <button className="underline" disabled={disabled || book.currentPage <= 1} onClick={() => void onChange({ action: "page", page: book.currentPage - 1 })}>Previous page</button>
      <form className="flex items-center gap-2" onSubmit={event => {
        event.preventDefault(); const page = Number(new FormData(event.currentTarget).get("page"));
        if (Number.isInteger(page) && page >= 1 && page <= book.totalPages && !disabled) void onChange({ action: "page", page });
      }}><label>Page <input aria-label="Page number" type="number" min={1} max={book.totalPages} key={book.currentPage} name="page" defaultValue={book.currentPage} disabled={disabled} className="w-20 rounded border p-1" /></label><span>of {book.totalPages}</span><button className="underline" disabled={disabled}>Go</button></form>
      <button className="underline" disabled={disabled || book.currentPage >= book.totalPages} onClick={() => void onChange({ action: "page", page: book.currentPage + 1 })}>Next page</button>
      <button className="underline" aria-label="Zoom out" disabled={disabled || zoom <= 0.5} onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}>−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button className="underline" aria-label="Zoom in" disabled={disabled || zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + 0.25))}>+</button>
      <button className="underline" disabled={disabled} onClick={() => setZoom(1)}>Fit page width</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3">{error} <button className="underline" onClick={() => { setPdf(null); setRendered(null); setError(""); setRetry(value => value + 1); }}>Retry opening</button></p>}
    <p role="status" className="mt-3">{busy ? "Saving progress…" : ready ? `Page ${book.currentPage} of ${book.totalPages} · Saved` : error ? "Page unavailable" : "Loading page…"}</p>
    <div className="mt-3 flex flex-wrap gap-4">
      <button className="underline" disabled={disabled} aria-pressed={marking} onClick={() => setMarking(value => !value)}>{marking ? "Stop placing checkmarks" : "Place checkmarks"}</button>
      <button className="underline" disabled={disabled} onClick={() => void onChange({ action: "addMark", page: book.currentPage, x: 0.5, y: 0.5 })}>Add checkmark at page center</button>
    </div>
    {marking && <p className="mt-2 text-sm">Click or tap a spot on the page to mark it. Click a checkmark to remove it.</p>}
    <div ref={container} className="mt-4 max-w-full overflow-auto rounded-xl bg-[#dfe5df] p-2">
      <div className="relative mx-auto bg-white" style={{ width: size.width, height: size.height, visibility: ready ? "visible" : "hidden" }}>
        <canvas ref={canvas} role="img" aria-label={`PDF page ${book.currentPage} of ${book.name}`} style={{ width: size.width, height: size.height }} />
        {marking && <div aria-hidden="true" className="absolute inset-0 cursor-crosshair" onClick={event => {
          if (disabled) return; const rect = event.currentTarget.getBoundingClientRect();
          void onChange({ action: "addMark", page: book.currentPage, x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) });
        }} />}
        {marks.map((mark, index) => <button key={mark.id} disabled={disabled} aria-label={`Remove checkmark ${index + 1}`} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 px-1 text-2xl font-bold text-green-800 shadow" style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }} onClick={() => void onChange({ action: "removeMark", markId: mark.id })}>✓</button>)}
      </div>
    </div>
    <p className="mt-3 text-sm">{marks.length} checkmarks on this page · {book.marks.length} in this book</p>
  </section>;
}
