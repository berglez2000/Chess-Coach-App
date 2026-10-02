import "server-only";
import { MAX_PDF_BYTES } from "./contract";

export class BookError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Bound actual streamed bytes as well as Content-Length before buffering an upload. */
export async function readPdfUpload(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length")) > MAX_PDF_BYTES) throw new BookError("PDFs must be 100 MB or smaller.", 413);
  if (!request.body) throw new BookError("Choose a PDF file.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PDF_BYTES) { await reader.cancel(); throw new BookError("PDFs must be 100 MB or smaller.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  if (size < 8 || !new TextDecoder().decode(data.subarray(0, 1024)).includes("%PDF-")) throw new BookError("This file is not a valid PDF.");
  return data;
}

export async function inspectPdf(data: Uint8Array<ArrayBuffer>) {
  // The legacy build provides Node canvas support. Externalized in next.config.ts.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: data.slice(), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    if (!Number.isSafeInteger(pdf.numPages) || pdf.numPages < 1 || pdf.numPages > 10000) throw new BookError("PDFs must contain between 1 and 10,000 pages.");
    const page = await pdf.getPage(1);
    let thumbnail: Uint8Array<ArrayBuffer> | null = null;
    // A thumbnail is optional: image/font errors must not lose a readable PDF.
    try {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 180 / Math.max(base.width, base.height) });
      const factory = pdf.canvasFactory as { create(w: number, h: number): { canvas: HTMLCanvasElement & { toBuffer(type: string): Buffer } }; destroy(target: object): void };
      const target = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        await page.render({ canvas: target.canvas, viewport }).promise;
        thumbnail = new Uint8Array(target.canvas.toBuffer("image/png"));
      } finally { factory.destroy(target); }
    } catch { /* The library uses a title placeholder if no thumbnail is available. */ }
    return { totalPages: pdf.numPages, thumbnail };
  } catch (error) {
    if (error instanceof BookError) throw error;
    throw new BookError("Could not read this PDF. Choose a valid, unencrypted PDF.");
  } finally { await task.destroy(); }
}
