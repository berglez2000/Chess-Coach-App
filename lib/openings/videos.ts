import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { OpeningError } from "./content";
import { PRIVATE_HEADERS } from "./http";
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
function directory() { return join(process.cwd(), ".storage", "opening-videos"); }
export function videoPath(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new OpeningError("Video not found.", 404);
  return join(directory(), `${id}.mp4`);
}
export async function removeVideoFile(id: string) { await unlink(videoPath(id)).catch(error => { if (error.code !== "ENOENT") throw error; }); }
export async function storeVideo(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "video/mp4") throw new OpeningError("Choose an MP4 video.");
  if (Number(request.headers.get("content-length")) > MAX_VIDEO_BYTES) throw new OpeningError("Videos must be 100 MB or smaller.", 413);
  if (!request.body) throw new OpeningError("Video data is missing.");
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const id = randomUUID(); const path = videoPath(id); const temp = `${path}.upload`;
  const file = await open(temp, "wx", 0o600); const reader = request.body.getReader();
  let size = 0; let head = Buffer.alloc(0);
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > MAX_VIDEO_BYTES) throw new OpeningError("Videos must be 100 MB or smaller.", 413);
      if (head.length < 32) head = Buffer.concat([head, Buffer.from(value).subarray(0, 32 - head.length)]);
      await file.writeFile(value);
    }
    if (size < 24 || head.toString("ascii", 4, 8) !== "ftyp" || head.readUInt32BE(0) < 16 || head.readUInt32BE(0) > size || !/(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)/.test(head.toString("ascii", 8))) throw new OpeningError("This file is not a supported MP4 container.");
    await file.close(); await rename(temp, path);
    return { id, size };
  } catch (error) { await file.close().catch(() => {}); await unlink(temp).catch(() => {}); throw error; }
  finally { await reader.cancel(); reader.releaseLock(); }
}
export function videoRange(header: string | null, size: number): { start: number; end: number; partial: boolean } | null {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end, partial: true };
}
export async function streamVideo(id: string, size: number, request: Request) {
  const range = videoRange(request.headers.get("range"), size);
  const headers = { ...PRIVATE_HEADERS, "Content-Type": "video/mp4", "Accept-Ranges": "bytes" };
  if (!range) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  // Open before responding so missing storage produces useful feedback rather than a broken stream.
  const file = await open(videoPath(id), "r").catch(() => { throw new OpeningError("Video file unavailable. Restore the app’s video storage or upload it again.", 503); });
  const info = await file.stat(); await file.close();
  if (info.size !== size) throw new OpeningError("Video file is incomplete. Upload it again.", 503);
  const { start, end, partial } = range;
  const source = createReadStream(videoPath(id), { start, end });
  const body = Readable.toWeb(source) as ReadableStream<Uint8Array>;
  return new Response(body, { status: partial ? 206 : 200, headers: { ...headers, "Content-Length": String(end - start + 1), ...(partial ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) } });
}
