"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { MAX_PDF_BYTES, type BookSummary, type ReaderBook } from "@/lib/books/contract";
import { BookReader, type ReaderAction } from "./book-reader";

export function BookLibrary({ ownerId }: { ownerId: string }) {
  const { data, isPending } = authClient.useSession();
  // Unmount the reader and its PDF worker when a session changes, including another tab.
  if (isPending) return <p role="status">Checking your account…</p>;
  if (data?.user.id !== ownerId) return <p role="alert">Your account session changed. <a href="/books" className="underline">Reload your books</a> or <a href="/sign-in" className="underline">sign in</a>.</p>;
  return <AccountBooks />;
}

function AccountBooks() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [book, setBook] = useState<ReaderBook | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
    {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3">{error}</p>}
    <BookReader key={book.id} book={book} busy={busy} onChange={change} onBack={() => { if (!lock.current) { setBook(null); setError(""); } }} />
  </>;

  return <>
    <h1 className="text-3xl font-semibold">Your books</h1>
    <p className="mt-3 text-sm text-[#465c50]">PDFs, reading position, and checkmarks are saved privately to your account and available on your other devices.</p>
    <p className="mt-2 text-sm">Import PDFs up to 100 MB each. To move books from the standalone reader, re-import the original PDFs here; its old reading position and checkmarks are not transferred.</p>
    <label className="mt-6 block rounded-2xl border border-dashed border-[#20382e]/40 bg-white p-6"
      onDragOver={event => event.preventDefault()} onDrop={event => {
        event.preventDefault(); if (!busy) void importFiles(Array.from(event.dataTransfer.files));
      }}>
      <span className="block font-semibold">Import PDFs</span>
      <span className="mt-1 block text-sm">Choose files or drop them here.</span>
      <input type="file" accept=".pdf,application/pdf" multiple disabled={busy || loading} className="mt-3 block max-w-full" onChange={event => {
        const files = Array.from(event.target.files ?? []); event.target.value = ""; void importFiles(files);
      }} />
    </label>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3">{error}</p>}
    <p role="status" aria-live="polite" className="mt-4">{busy ? "Saving your books…" : loading ? "Loading your books…" : notice}</p>
    {!loading && !books.length && <p className="mt-4">No books yet. Import a PDF to start reading.</p>}
    <button type="button" className="mt-3 underline" disabled={busy || loading} onClick={() => void load()}>Refresh library</button>
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {books.map(item => <li key={item.id} className="min-w-0 rounded-2xl border border-[#20382e]/15 bg-white p-5">
        {item.hasThumbnail && /* Private endpoint: never pass these images through Next's public optimizer. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/books/${item.id}/thumbnail`} alt="" loading="lazy" className="mb-3 h-40 max-w-full object-contain" />}
        <h2 className="break-words text-lg font-semibold">{item.name}</h2>
        <p className="mt-2 text-sm">Page {item.currentPage} of {item.totalPages}</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <button className="underline" disabled={busy} onClick={() => void run(async () => setBook((await request(`/api/books/${item.id}`)).book))}>Read {item.name}</button>
          <button className="underline" disabled={busy} onClick={() => setRemoving(item.id)}>Remove {item.name}</button>
        </div>
        {removing === item.id && <div className="mt-4 rounded bg-[#f3f0e6] p-3">
          <p>Remove this PDF and its reading progress and checkmarks?</p>
          <div className="mt-2 flex gap-4"><button className="underline" disabled={busy} onClick={() => void run(async () => {
            await request(`/api/books/${item.id}`, { method: "DELETE" }); setBooks(rows => rows.filter(row => row.id !== item.id)); setRemoving(null); setNotice("Book removed.");
          })}>Confirm removal</button><button className="underline" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button></div>
        </div>}
      </li>)}
    </ul>
  </>;

  async function importFiles(files: File[]) {
    if (!files.length) return;
    await run(async () => {
      const failures: string[] = []; let count = 0;
      for (const file of files) {
        try {
          if (file.size > MAX_PDF_BYTES) throw new Error("PDFs must be 100 MB or smaller.");
          if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") throw new Error("Choose a PDF file.");
          const name = file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").trim().slice(0, 200) || "Untitled book";
          const saved: ReaderBook = (await request(`/api/books?${new URLSearchParams({ name })}`, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: file })).book;
          setBooks(rows => [saved, ...rows.filter(row => row.id !== saved.id)]); count++;
        } catch (error) { failures.push(`${file.name}: ${message(error)}`); }
      }
      setNotice(`${count} PDF${count === 1 ? "" : "s"} imported. Re-importing the same PDF keeps its progress.`);
      if (failures.length) setError(failures.join(" "));
    });
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Could not load or save your books. Please try again."; }
