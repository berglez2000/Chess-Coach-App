"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import styles from "./book-library.module.css";
import { authClient } from "@/lib/auth/client";
import { MAX_PDF_BYTES, type BookSummary, type ReaderBook } from "@/lib/books/contract";
import { BookReader, type ReaderAction } from "./book-reader";

export function BookLibrary({ ownerId }: { ownerId: string }) {
  const { data, isPending } = authClient.useSession();
  // Unmount the reader and its PDF worker when a session changes, including another tab.
  if (isPending) return <p role="status">Checking your account…</p>;
  // A full reload clears cached private content after an account change.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  if (data?.user.id !== ownerId) return <p role="alert">Your account session changed. <a href="/learning" className="underline">Reload your books</a> or <a href="/sign-in" className="underline">sign in</a>.</p>;
  return <AccountBooks />;
}

function AccountBooks() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [book, setBook] = useState<ReaderBook | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState("");
  const [uploadBatch, setUploadBatch] = useState({ completed: 0, total: 0 });
  const [removing, setRemoving] = useState<string | null>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const request = useCallback(async (url: string, options?: RequestInit) => {
    const response = await fetch(url, { ...options, cache: "no-store", signal: controller.current?.signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? "Could not load or save your books. Please try again.");
    return result;
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setBooks((await request("/api/books")).books); }
    catch (error) { if (!controller.current?.signal.aborted) setError(message(error)); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    void Promise.resolve().then(() => { if (!abort.signal.aborted) void load(); });
    return () => { abort.abort(); };
  }, [load]);

  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await work(); }
    catch (error) { if (!controller.current?.signal.aborted) setError(message(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  function update(next: ReaderBook) {
    setBook(next); setBooks(rows => rows.map(row => row.id === next.id ? next : row));
  }
  async function change(action: ReaderAction) {
    if (!book) return;
    await run(async () => {
      try { update((await request(`/api/books/${book.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...action, revision: book.revision }) })).book); }
      catch (error) {
        // A lost response may have committed. Reconcile instead of replaying an add-mark.
        try { update((await request(`/api/books/${book.id}`)).book); }
        catch { setBook(null); }
        throw error;
      }
    });
  }

  if (book) return <>
    <BookReader key={book.id} saveError={error} book={book} busy={busy} onChange={change} onBack={() => { if (!lock.current) { setBook(null); setError(""); } }} />
  </>;

  return <>
    <header className={styles.pageHeader}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className={styles.breadcrumbSeparator} aria-hidden="true">/</span><span aria-current="page">Learning</span>
      </nav>
      <h1 className={styles.pageTitle}>Your library</h1>
      <p className={styles.pageSubtitle}>Upload chess books as PDFs to read and annotate with checkmarks. Reading position and marks are saved privately to your account.</p>
      <nav className={styles.learningLinks} aria-label="Learning tools"><Link href="/learning/materials">Study materials</Link><Link href="/learning/history">Exercise history</Link><Link href="/learning/profile">Learning profile</Link><Link href="/learning/plan">Weekly plan</Link></nav>
    </header>
    <label className={`${styles.uploadZone} ${dragging ? styles.dragOver : ""}`} aria-disabled={busy || loading}
      onDragEnter={event => { event.preventDefault(); if (!busy && !loading) setDragging(true); }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy || loading ? "none" : "copy"; }}
      onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={event => {
        event.preventDefault(); setDragging(false);
        if (!busy && !loading) void importFiles(Array.from(event.dataTransfer.files));
      }}>
      <span className={styles.uploadIcon}><Icon name="upload" size={22}/></span>
      <span className={styles.uploadTitle}>Add a book</span>
      <span className={styles.uploadSubtitle}>Drag and drop a PDF here, or click to browse</span>
      <span className={styles.uploadButton}><Icon name="upload" size={15}/>Choose PDF</span>
      <span className={styles.uploadMeta}>PDF only · Up to 100 MB per file · Multiple files supported</span>
      <input type="file" aria-label="Choose PDFs" accept=".pdf,application/pdf" multiple disabled={busy || loading} className="sr-only" onChange={event => {
        const files = Array.from(event.target.files ?? []); event.target.value = ""; void importFiles(files);
      }} />
    </label>
    {uploading && <div className={styles.uploadProgress} role="status" aria-live="polite">
      <span className={styles.uploadProgressIcon}><Icon name="books" size={18}/></span>
      <div className={styles.uploadProgressInfo}>
        <p className={styles.uploadProgressName}>{uploading}</p>
        <progress className={styles.uploadProgressBar} aria-label="Books imported" value={uploadBatch.completed} max={uploadBatch.total}/>
      </div>
      <span className={styles.uploadProgressCount}>{uploadBatch.completed} / {uploadBatch.total} imported</span>
    </div>}
    {error && <p role="alert" className={styles.alert}>{error}</p>}
    <p role="status" aria-live="polite" className={styles.status}>{busy ? uploading ? `Importing ${uploading}…` : "Saving your books…" : loading ? "Loading your books…" : notice}</p>
    <section aria-labelledby="books-heading">
      <div className={styles.sectionHeader}>
        <h2 id="books-heading" className={styles.sectionTitle}>Books</h2>
        <div className={styles.sectionTools}>
          {!loading && <span className={styles.sectionCount}>{books.length} {books.length === 1 ? "book" : "books"}</span>}
          <button type="button" className={styles.refresh} disabled={busy || loading} onClick={() => void load()}>Refresh library</button>
        </div>
      </div>
      {!loading && !books.length && !error && <div className={styles.emptyState}><span className={styles.emptyIcon}><Icon name="books" size={26}/></span><h3 className={styles.emptyTitle}>No books yet</h3><p className={styles.emptySubtitle}>Upload your first chess book to start reading and marking your progress.</p></div>}
      <ul className={styles.booksGrid}>
        {books.map(item => {
          const started = item.lastRead !== null || item.currentPage > 1;
          const percent = started ? item.currentPage / item.totalPages * 100 : 0;
          return <li key={item.id} className={styles.bookCard}>
            <div className={styles.bookCover}>
              <button type="button" className={styles.coverButton} aria-label={`Preview ${item.name}`} disabled={busy} onClick={() => void openBook(item.id)}><BookCover book={item}/></button>
              {item.markCount > 0 && <span className={styles.checkmarkBadge}><Icon name="check" size={11}/>{item.markCount} {item.markCount === 1 ? "mark" : "marks"}</span>}
              <div className={styles.bookProgressBar} role="progressbar" aria-label={`Reading progress for ${item.name}`} aria-valuemin={0} aria-valuemax={item.totalPages} aria-valuenow={started ? item.currentPage : 0} aria-valuetext={started ? `Page ${item.currentPage} of ${item.totalPages}` : "Not started"}><div className={styles.bookProgressFill} style={{ width: `${percent}%` }}/></div>
            </div>
            <div className={styles.bookInfo}>
              <h3 className={styles.bookTitle} title={item.name}>{item.name}</h3>
              <p className={styles.bookMeta}>{started ? `p. ${item.currentPage} / ${item.totalPages}` : `Not started · ${item.totalPages} pages`}</p>
              <div className={styles.bookActions}>
                <button type="button" className={`${styles.actionButton} ${styles.readButton}`} aria-label={`${started ? "Continue" : "Open"} ${item.name}`} disabled={busy} onClick={() => void openBook(item.id)}>{started ? "Continue" : "Open"}</button>
                <button type="button" className={`${styles.actionButton} ${styles.removeButton}`} aria-label={`Remove ${item.name}`} disabled={busy} onClick={() => setRemoving(item.id)}>Remove</button>
              </div>
            </div>
            {removing === item.id && <div role="group" aria-label={`Confirm removal of ${item.name}`} className={styles.confirmation}>
              <p>Remove this PDF and its reading progress and checkmarks?</p>
              <div className={styles.confirmationActions}>
                <button type="button" className={`${styles.actionButton} ${styles.removeButton}`} disabled={busy} onClick={() => void run(async () => {
                  await request(`/api/books/${item.id}`, { method: "DELETE" }); setBooks(rows => rows.filter(row => row.id !== item.id)); setRemoving(null); setNotice("Book removed.");
                })}>Confirm removal</button>
                <button type="button" className={`${styles.actionButton} ${styles.readButton}`} disabled={busy} onClick={() => setRemoving(null)}>Cancel</button>
              </div>
            </div>}
          </li>;
        })}
      </ul>
    </section>
  </>;

  async function openBook(id: string) {
    await run(async () => setBook((await request(`/api/books/${id}`)).book));
  }

  async function importFiles(files: File[]) {
    if (!files.length) return;
    await run(async () => {
      const failures: string[] = []; let count = 0;
      setUploadBatch({ completed: 0, total: files.length });
      for (const file of files) {
        setUploading(file.name);
        try {
          if (file.size > MAX_PDF_BYTES) throw new Error("PDFs must be 100 MB or smaller.");
          if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") throw new Error("Choose a PDF file.");
          const name = file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").trim().slice(0, 200) || "Untitled book";
          const saved: ReaderBook = (await request(`/api/books?${new URLSearchParams({ name })}`, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: file })).book;
          setBooks(rows => [saved, ...rows.filter(row => row.id !== saved.id)]); count++;
          setUploadBatch({ completed: count, total: files.length });
        } catch (error) { failures.push(`${file.name}: ${message(error)}`); }
      }
      setUploading("");
      setNotice(`${count} PDF${count === 1 ? "" : "s"} imported. Re-importing the same PDF keeps its progress.`);
      if (failures.length) setError(failures.join(" "));
    });
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Could not load or save your books. Please try again."; }

function BookCover({ book }: { book: BookSummary }) {
  const [failed, setFailed] = useState(false);
  if (book.hasThumbnail && !failed) {
    // Private images must bypass the public Next.js image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/books/${book.id}/thumbnail`} alt="" loading="lazy" className={styles.coverImage} onError={() => setFailed(true)}/>;
  }
  return <span className={styles.fallbackCover} aria-hidden="true"><span className={styles.fallbackPaper}><span className={styles.fallbackLabel}>Chess library</span><span className={styles.fallbackTitle}>{book.name}</span><span className={styles.fallbackPieces}>♞ ♜ ♝</span><span className={styles.fallbackLabel}>PDF · {book.totalPages} pages</span></span></span>;
}
