"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./book-reader.module.css";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { PDF_WORKER_URL, PDF_BROWSER_RESOURCES, type BookAction, type ReaderBook } from "@/lib/books/contract";

export type ReaderAction = BookAction extends infer A ? A extends BookAction ? Omit<A, "revision"> : never : never;
export function BookReader({ book, busy, onChange, onBack, saveError }: { book: ReaderBook; busy: boolean; saveError?: string; onChange: (action: ReaderAction) => Promise<void>; onBack: () => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState<{ pdf: PDFDocumentProxy; page: number; width: number; zoom: number | "fit" } | null>(null);
  const [zoom, setZoom] = useState<number | "fit">(1);
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
    const observer = new ResizeObserver(() => {
      const css = getComputedStyle(element);
      setWidth(Math.max(160, element.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)));
    });
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
        task = pdfjs.getDocument({ data, useSystemFonts: true, ...PDF_BROWSER_RESOURCES });
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
        const pageWidth = zoom === "fit" ? width : Math.min(width, 760) * zoom;
        const viewport = page.getViewport({ scale: pageWidth / base.width });
        const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (viewport.width * viewport.height)));
        const target = canvas.current;
        target.width = Math.ceil(viewport.width * ratio); target.height = Math.ceil(viewport.height * ratio);
        setSize({ width: viewport.width, height: viewport.height });
        task = page.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
        if (active) {
          setRendered({ pdf, page: book.currentPage, width, zoom });
        }
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
  useEffect(() => { container.current?.scrollTo({ top: 0, left: 0 }); }, [book.currentPage]);

  const marks = book.marks.filter(mark => mark.page === book.currentPage);
  const numericZoom = zoom === "fit" ? width / Math.min(width, 760) : zoom;
  const button = styles.button;
  const iconButton = `${button} ${styles.iconButton}`;
  return <section aria-label="Book reader" data-book-reader className={styles.reader}>
    <header className={styles.topbar}>
      <button type="button" disabled={busy} className={styles.back} aria-label="Back to books" onClick={onBack}><ReaderIcon name="back"/>Library</button>
      <span className={styles.divider} aria-hidden="true"/>
      <h1 className={styles.title} title={book.name}>{book.name}</h1>
      <p className={styles.subtitle}>Saved to your library · checkmarks sync across devices</p>
    </header>
    <div className={styles.toolbar} role="group" aria-label="Reader controls">
      <div className={styles.group}>
        <button type="button" className={iconButton} aria-label="Previous page" title="Previous page" disabled={disabled || book.currentPage <= 1} onClick={() => void onChange({ action: "page", page: book.currentPage - 1 })}><ReaderIcon name="previous"/></button>
        <form className={styles.pageForm} onSubmit={event => {
          event.preventDefault(); const page = Number(new FormData(event.currentTarget).get("page"));
          if (Number.isInteger(page) && page >= 1 && page <= book.totalPages && !disabled) void onChange({ action: "page", page });
        }}>
          <label>Page <input aria-label="Page number" type="number" min={1} max={book.totalPages} key={book.currentPage} name="page" defaultValue={book.currentPage} disabled={disabled} className={styles.pageInput}/></label>
          <span className={styles.total}>of {book.totalPages}</span>
          <button className={button} disabled={disabled}>Go</button>
        </form>
        <button type="button" className={iconButton} aria-label="Next page" title="Next page" disabled={disabled || book.currentPage >= book.totalPages} onClick={() => void onChange({ action: "page", page: book.currentPage + 1 })}><ReaderIcon name="next"/></button>
      </div>
      <span className={styles.divider} aria-hidden="true"/>
      <div className={styles.group}>
        <button type="button" className={iconButton} aria-label="Zoom out" title="Zoom out" disabled={disabled || numericZoom <= .5} onClick={() => setZoom(Math.max(.5, Math.round((numericZoom - .25) * 4) / 4))}><ReaderIcon name="zoomOut"/></button>
        <select className={styles.zoomSelect} aria-label="Zoom level" value={zoom} disabled={disabled} onChange={event => setZoom(event.target.value === "fit" ? "fit" : Number(event.target.value))}>
          {[.5, .75, 1, 1.25, 1.5, 1.75, 2].map(value => <option key={value} value={value}>{value * 100}%</option>)}
          <option value="fit">Fit width</option>
        </select>
        <button type="button" className={iconButton} aria-label="Zoom in" title="Zoom in" disabled={disabled || numericZoom >= 2} onClick={() => setZoom(Math.min(2, Math.round((numericZoom + .25) * 4) / 4))}><ReaderIcon name="zoomIn"/></button>
        <button type="button" className={button} aria-label="Fit page width" onClick={() => setZoom("fit")} disabled={disabled}><ReaderIcon name="fit"/>Fit width</button>
      </div>
      <span className={styles.divider} aria-hidden="true"/>
      <button type="button" className={`${button} ${marking ? styles.active : ""}`} disabled={disabled} aria-pressed={marking} onClick={() => setMarking(value => !value)}><Icon name="check" size={15}/>Place checkmarks</button>
      <button type="button" className={iconButton} title="Add checkmark at page center" aria-label="Add checkmark at page center" disabled={disabled} onClick={() => void onChange({ action: "addMark", page: book.currentPage, x: .5, y: .5 })}><ReaderIcon name="addMark"/></button>
      <div className={styles.checkmarkCount}><Icon name="check" size={13}/><span>{marks.length} on this page · {book.marks.length} total</span></div>
    </div>
    {saveError && <p role="alert" className={styles.alert}>{saveError}</p>}
    {error && <p role="alert" className={styles.alert}>{error}<button type="button" onClick={() => { setPdf(null); setRendered(null); setError(""); setRetry(value => value + 1); }}>Retry opening</button></p>}
    <div className={styles.status}>
      <p role="status" aria-live="polite">{busy ? "Saving progress…" : ready ? `Page ${book.currentPage} of ${book.totalPages} · Saved` : error ? "Page unavailable" : "Loading page…"}</p>
      <span className={styles.keyboardHelp}>← → Turn pages · Esc Return to library</span>
    </div>
    <div ref={container} className={styles.viewport} role="region" aria-label="PDF viewport" tabIndex={0}>
      <div className={styles.pdfPage} style={{ width: size.width, height: size.height, visibility: ready ? "visible" : "hidden" }}>
        <canvas ref={canvas} role="img" aria-label={`PDF page ${book.currentPage} of ${book.name}`} style={{ width: size.width, height: size.height }}/>
        {marking && <div aria-hidden="true" className={styles.markingOverlay} onClick={event => {
          if (disabled) return; const rect = event.currentTarget.getBoundingClientRect();
          void onChange({ action: "addMark", page: book.currentPage, x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) });
        }}/>}
        {marks.map((mark, index) => <button type="button" key={mark.id} disabled={disabled} aria-label={`Remove checkmark ${index + 1}`} title="Remove checkmark" className={styles.mark} style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }} onClick={() => void onChange({ action: "removeMark", markId: mark.id })}><Icon name="check" size={32}/></button>)}
      </div>
    </div>
    {marking && <p className={styles.hint}><Icon name="check" size={14}/>Click or tap the page to add a checkmark. Click a checkmark to remove it.</p>}
  </section>;
}

type ReaderIconName = "back" | "previous" | "next" | "zoomIn" | "zoomOut" | "fit" | "addMark";
function ReaderIcon({ name }: { name: ReaderIconName }) {
  const paths: Record<ReaderIconName, React.ReactNode> = {
    back: <path d="M15 9H3m5-5L3 9l5 5"/>,
    previous: <path d="M11 4L6 9l5 5"/>,
    next: <path d="M7 4l5 5-5 5"/>,
    zoomIn: <><circle cx="7.5" cy="7.5" r="5.5"/><path d="M12 12l4 4M5 7.5h5M7.5 5v5"/></>,
    zoomOut: <><circle cx="7.5" cy="7.5" r="5.5"/><path d="M12 12l4 4M5 7.5h5"/></>,
    fit: <><path d="M2 6V3h14v3M2 12v3h14v-3M2 9h5m-2-2l2 2-2 2M16 9h-5m2-2l-2 2 2 2"/></>,
    addMark: <><circle cx="9" cy="9" r="7"/><path d="M5 9l3 3 5-5"/></>,
  };
  return <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
