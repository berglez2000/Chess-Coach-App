import { expect, it } from "vitest";
import { readAuthConfig } from "@/lib/auth/config";
import { requireOwnerId } from "@/lib/auth/owner";

const env = { BETTER_AUTH_SECRET: "a".repeat(40), BETTER_AUTH_URL: "http://127.0.0.1:3000" };
it("accepts local origins and HTTPS hosting without exposing configuration", () => {
  expect(readAuthConfig(env).baseURL).toBe(env.BETTER_AUTH_URL);
  expect(readAuthConfig({ ...env, BETTER_AUTH_URL: "https://chess.example/" }).baseURL).toBe("https://chess.example");
});
it.each(["", "http://remote.example", "https://user:secret@example.com", "https://example.com/subpath", "https://example.com?secret=yes"])("rejects unsafe or ambiguous origins (%#)", url => {
  expect(() => readAuthConfig({ ...env, BETTER_AUTH_URL: url })).toThrow("BETTER_AUTH_URL");
});
it("requires a stable secret and refuses missing ownership filters", () => {
  expect(() => readAuthConfig({ ...env, BETTER_AUTH_SECRET: "short" })).toThrow("BETTER_AUTH_SECRET");
  for (const id of [undefined, null, "", " "]) expect(() => requireOwnerId(id as string)).toThrow();
});
