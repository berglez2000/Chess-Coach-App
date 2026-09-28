import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { OpenAICoachingClient, createCoachingClient, createAnthropicClient, createOpenAIClient, providerSchemaShape, type CoachingRequest } from "@/lib/coaching/ai-client";
import { COACHING_DEADLINE_MS, PROVIDERS, PROVIDER_TIMEOUT_MS } from "@/lib/coaching/providers";

const valid = { schemaVersion: 1, summary: "Check candidate moves.", strengths: [], improvements: [], criticalMoments: [{ ply: 1, classification: "normal", headline: null, explanation: "Compare the supplied line.", lesson: "Check threats.", category: "calculation.candidate_moves" }] };
const request: CoachingRequest = { payload: { systemPrompt: "Coach", userMessage: "Facts", responseSchema: { type: "object", additionalProperties: false } }, gamePlies: new Set([1, 2]), selectedPlies: new Set([1]), engineQuality: new Map([[1, "mistake"]]) };
const response = (raw: unknown = valid) => ({ status: "completed", model: "gpt-actual-snapshot", output: [], output_text: JSON.stringify(raw) });
const client = (create: ReturnType<typeof vi.fn>) => new OpenAICoachingClient({ responses: { create } } as unknown as OpenAI);

describe("OpenAI coaching", () => {
  it("requests strict Responses output, shares engine-authoritative validation, and records the actual model", async () => {
    const create = vi.fn().mockResolvedValue(response());
    const result = await client(create).requestCoaching(request);
    expect(create.mock.calls[0][0]).toMatchObject({ model: PROVIDERS.OPENAI.model, store: false, text: { format: { type: "json_schema", strict: true, schema: request.payload.responseSchema } } });
    expect(result).toMatchObject({ status: "OK", annotation: { model: "gpt-actual-snapshot", moments: [{ effectiveClassification: "mistake" }] } });
  });
  it.each([
    [{ ...response(), output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] }, "REFUSAL"],
    [{ ...response(), status: "incomplete" }, "INCOMPLETE_OUTPUT"],
    [{ ...response(), status: "failed" }, "API_ERROR"],
    [{ ...response(), output_text: "not json" }, "INVALID_RESPONSE"],
    [response({ ...valid, summary: "x".repeat(501) }), "INVALID_RESPONSE"],
    [response({ ...valid, criticalMoments: [{ ...valid.criticalMoments[0], ply: 2 }] }), "INVALID_RESPONSE"],
    [response({ ...valid, criticalMoments: [...valid.criticalMoments, ...valid.criticalMoments] }), "INVALID_RESPONSE"],
  ])("rejects invalid/refused/incomplete output (%#)", async (value, status) => {
    expect(await client(vi.fn().mockResolvedValue(value)).requestCoaching(request)).toMatchObject({ status });
  });
  it.each([
    [new OpenAI.AuthenticationError(401, {}, "secret", new Headers()), "MISSING_KEY"],
    [new OpenAI.RateLimitError(429, {}, "secret", new Headers()), "RATE_LIMIT"],
    [new OpenAI.APIConnectionError({ message: "secret" }), "TIMEOUT"],
    [new OpenAI.InternalServerError(500, {}, "secret", new Headers()), "API_ERROR"],
  ])("sanitizes provider errors (%#)", async (error, status) => {
    const result = await client(vi.fn().mockRejectedValue(error)).requestCoaching(request);
    expect(result).toMatchObject({ status });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
it("bounds both SDKs below the application deadline with no automatic retries", () => {
  for (const sdk of [createOpenAIClient("test-not-a-key"), createAnthropicClient("test-not-a-key")]) {
    expect(sdk.timeout).toBe(PROVIDER_TIMEOUT_MS);
    expect(sdk.maxRetries).toBe(0);
    expect(sdk.timeout).toBeLessThan(COACHING_DEADLINE_MS);
  }
});
it("rejects an unsupported provider and never falls back when the selected key is missing", async () => {
  vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("ANTHROPIC_API_KEY", "unused-test-key");
  try {
    expect(await createCoachingClient("OPENAI").requestCoaching(request)).toEqual({ status: "MISSING_KEY" });
    expect(() => createCoachingClient("invalid" as "OPENAI")).toThrow();
  } finally { vi.unstubAllEnvs(); }
});
it("adapts nested unsupported wire constraints without mutating the original schema", () => {
  const schema = { type: "object", properties: { moments: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 20 } } } };
  expect(providerSchemaShape(schema)).toEqual({ type: "object", properties: { moments: { type: "array", items: { type: "string" } } } });
  expect(schema.properties.moments.maxItems).toBe(10);
});
