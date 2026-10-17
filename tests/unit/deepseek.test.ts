import { afterEach, expect, it, vi } from "vitest";
import { createCoachingClient, type CoachingRequest } from "@/lib/coaching/ai-client";
import { createDeepSeekClient } from "@/lib/coaching/deepseek";
import { COACHING_MODELS, PROVIDER_TIMEOUT_MS } from "@/lib/coaching/providers";
import { createPlanClient, PLAN_TIMEOUT_MS } from "@/lib/weekly-plan/ai-client";
import { fixtureInputs, fixturePlan } from "../support/weekly-plan-fixtures";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request: CoachingRequest = {
  payload: { systemPrompt: "Coach", userMessage: "Facts", responseSchema: { type: "object", additionalProperties: false } },
  gamePlies: new Set([1]), selectedPlies: new Set([1]), engineQuality: new Map([[1, "mistake"]]),
};
const coaching = { schemaVersion: 1, summary: "Check candidate moves.", strengths: [], improvements: [], criticalMoments: [
  { ply: 1, classification: "normal", headline: null, explanation: "Compare the supplied line.", lesson: "Check threats.", category: "calculation.candidate_moves" },
] };
function response(data: unknown) {
  return Response.json({ id: "fixture", object: "response", status: "completed", model: "deepseek-actual-snapshot", output: [
    { type: "reasoning", content: [{ type: "reasoning_text", text: "Internal fixture reasoning" }] },
    { type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(data), annotations: [] }] },
  ] });
}
function configure() {
  vi.stubEnv("DEEPSEEK_API_KEY", "deepseek-fixture-key");
  vi.stubEnv("OPENAI_API_KEY", "openai-key-must-not-be-used");
  vi.stubEnv("OPENAI_BASE_URL", "https://example.invalid");
  vi.stubEnv("OPENAI_ORG_ID", "openai-org-must-not-be-sent");
  vi.stubEnv("OPENAI_PROJECT_ID", "openai-project-must-not-be-sent");
}

it.each(COACHING_MODELS.DEEPSEEK)("uses only DeepSeek credentials and endpoint for $id in coaching and plans", async ({ id: model }) => {
  configure();
  const fetch = vi.fn().mockResolvedValueOnce(response(coaching)).mockResolvedValueOnce(response(fixturePlan));
  vi.stubGlobal("fetch", fetch);
  expect(await createCoachingClient("DEEPSEEK", model).requestCoaching(request)).toMatchObject({
    status: "OK", annotation: { model: "deepseek-actual-snapshot", moments: [{ effectiveClassification: "mistake" }] },
  });
  expect(await createPlanClient("DEEPSEEK", model).generate(fixtureInputs, new AbortController().signal)).toMatchObject({
    status: "OK", model: "deepseek-actual-snapshot", definition: fixturePlan,
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [url, init] of fetch.mock.calls) {
    expect(String(url)).toBe("https://api.deepseek.com/responses");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer deepseek-fixture-key");
    expect(headers.has("OpenAI-Organization")).toBe(false);
    expect(headers.has("OpenAI-Project")).toBe(false);
    expect(JSON.parse(init.body)).toMatchObject({ model, reasoning: { effort: "low" }, text: { format: { type: "json_schema" } } });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  }
});

it("does not call another provider when the DeepSeek key is absent", async () => {
  configure(); vi.stubEnv("DEEPSEEK_API_KEY", " ");
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await createCoachingClient("DEEPSEEK").requestCoaching(request)).toEqual({ status: "MISSING_KEY" });
  expect(await createPlanClient("DEEPSEEK").generate(fixtureInputs, new AbortController().signal)).toMatchObject({ status: "FAILED", message: expect.stringContaining("no API key") });
  expect(fetch).not.toHaveBeenCalled();
});

it.each([[401, "MISSING_KEY"], [429, "RATE_LIMIT"], [500, "API_ERROR"]])("sanitizes DeepSeek HTTP %s errors without retrying", async (status, expected) => {
  configure();
  const fetch = vi.fn().mockImplementation(async () => Response.json({ error: { message: "private provider details" } }, { status: Number(status) }));
  vi.stubGlobal("fetch", fetch);
  const result = await createCoachingClient("DEEPSEEK").requestCoaching(request);
  expect(result).toMatchObject({ status: expected });
  expect(JSON.stringify(result)).not.toContain("private");
  expect(fetch).toHaveBeenCalledOnce();
});

it("uses each feature's timeout without automatic retries", () => {
  configure();
  expect(createDeepSeekClient().timeout).toBe(PROVIDER_TIMEOUT_MS);
  expect(createDeepSeekClient(PLAN_TIMEOUT_MS).timeout).toBe(PLAN_TIMEOUT_MS);
  expect(createDeepSeekClient().maxRetries).toBe(0);
});
