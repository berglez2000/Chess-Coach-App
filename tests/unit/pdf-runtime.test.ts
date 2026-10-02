import { expect, it, vi } from "vitest";
import { inspectPdf } from "@/lib/books/pdf";
import { bookFailure } from "@/lib/books/http";

vi.mock("../../scripts/check-node.mjs", () => ({ checkNodeVersion: () => { throw new Error("Chess Coach requires Node 24.15.0 or later within Node 24; currently running Node 20.19.4. Run nvm install and nvm use in this project, then restart the app."); } }));

it("reports unsupported PDF runtimes as an actionable unavailable response", async () => {
  const failure = await inspectPdf(new Uint8Array()).catch(error => error);
  const response = bookFailure(failure);
  expect(response.status).toBe(503);
  expect((await response.json()).error.message).toContain("nvm install and nvm use");
});
