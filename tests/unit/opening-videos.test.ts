import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { MAX_VIDEO_BYTES, removeVideoFile, storeVideo, streamVideo, videoPath, videoRange } from "@/lib/openings/videos";
function mp4() { const bytes = Buffer.alloc(32); bytes.writeUInt32BE(24, 0); bytes.write("ftyp", 4); bytes.write("isom", 8); bytes.write("mp42", 16); return bytes; }
it("validates byte ranges, including suffix and open-ended requests", () => {
  expect(videoRange("bytes=2-5", 10)).toEqual({ start: 2, end: 5, partial: true });
  expect(videoRange("bytes=-3", 10)).toEqual({ start: 7, end: 9, partial: true });
  expect(videoRange("bytes=5-", 10)).toEqual({ start: 5, end: 9, partial: true });
  expect(videoRange(null, 10)).toEqual({ start: 0, end: 9, partial: false });
  for (const header of ["bytes=99-", "bytes=5-2", "bytes=-0", "bytes=0-1,4-5", "bytes=-", "oops"]) expect(videoRange(header, 10)).toBeNull();
});
it("streams MP4 bytes and rejects missing files without leaking paths", async () => {
  const bytes = mp4(); const stored = await storeVideo(new Request("http://local/video", { method: "POST", headers: { "Content-Type": "video/mp4" }, body: bytes }));
  try {
    expect(await readFile(videoPath(stored.id))).toEqual(bytes);
    const response = await streamVideo(stored.id, stored.size, new Request("http://local/video", { headers: { range: "bytes=4-7" } }));
    expect(response.status).toBe(206); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("content-range")).toBe("bytes 4-7/32"); expect(await response.text()).toBe("ftyp");
    expect((await streamVideo(stored.id, stored.size, new Request("http://local/video", { headers: { range: "bytes=999-" } }))).status).toBe(416);
  } finally { await removeVideoFile(stored.id); }
  await expect(streamVideo(stored.id, stored.size, new Request("http://local/video"))).rejects.toThrow("unavailable");
});
it("rejects path traversal, fake MP4s and oversized uploads", async () => {
  expect(() => videoPath("../../private")).toThrow("not found");
  await expect(storeVideo(new Request("http://local", { method: "POST", headers: { "Content-Type": "video/mp4" }, body: "not an mp4 video file at all" }))).rejects.toThrow("MP4 container");
  await expect(storeVideo(new Request("http://local", { method: "POST", headers: { "Content-Type": "video/mp4", "Content-Length": String(MAX_VIDEO_BYTES + 1) }, body: mp4() }))).rejects.toThrow("100 MB");
  await expect(storeVideo(new Request("http://local", { method: "POST", headers: { "Content-Type": "text/plain" }, body: mp4() }))).rejects.toThrow("MP4");
});
