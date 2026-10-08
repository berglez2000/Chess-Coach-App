import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_POSITION } from "chess.js";
import { importOpeningUrl, pgnSourceUrl } from "@/lib/openings/url-import";

afterEach(() => vi.unstubAllGlobals());
it("imports every study chapter rather than just the selected chapter", () => {
  expect(pgnSourceUrl("https://lichess.org/study/abcdefgh/ijklmnop").href).toBe("https://lichess.org/study/abcdefgh.pgn");
});
it.each(["http://lichess.org/study/abcdefgh", "https://127.0.0.1/a.pgn", "https://user:secret@lichess.org/study/abcdefgh", "https://lichess.org.evil.test/study/abcdefgh", "https://lichess.org/api/account"])("rejects unsupported destinations: %s", url => {
  expect(() => pgnSourceUrl(url)).toThrow();
});
it("imports legal nested branches and multiple chapters with duplicates removed", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('[Event "Sicilian"]\n\n1. e4 c5 (1... e5 2. Nf3) 2. Nf3 *\n\n[Event "Duplicate"]\n\n1. e4 c5 2. Nf3 *')));
  const result = await importOpeningUrl({ url: "https://lichess.org/study/abcdefgh", startFen: DEFAULT_POSITION });
  expect(result.lines).toHaveLength(2);
  expect(result.lines.map(line => line.moves)).toContainEqual(["e2e4", "e7e5", "g1f3"]);
});
it("rejects redirects to private or unsupported hosts without fetching them", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } }));
  vi.stubGlobal("fetch", fetcher);
  await expect(importOpeningUrl({ url: "https://lichess.org/study/abcdefgh", startFen: DEFAULT_POSITION })).rejects.toThrow("Supported sources");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("bounds the downloaded body and rejects HTML and illegal moves", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const input = { url: "https://raw.githubusercontent.com/example/repo/main/opening.pgn", startFen: DEFAULT_POSITION };
  fetcher.mockResolvedValueOnce(new Response("x".repeat(250001)));
  await expect(importOpeningUrl(input)).rejects.toThrow("250 KB");
  fetcher.mockResolvedValueOnce(new Response("<!doctype html><html>login</html>"));
  await expect(importOpeningUrl(input)).rejects.toThrow("web page");
  fetcher.mockResolvedValueOnce(new Response("1. e5 *"));
  await expect(importOpeningUrl(input)).rejects.toThrow("Cannot import");
});
