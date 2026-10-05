import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { validatePlan } from "@/lib/weekly-plan/contract";
import { buildPlanPrompt } from "@/lib/weekly-plan/prompt";
import { AnthropicPlanClient, OpenAIPlanClient, createPlanClient, PLAN_TIMEOUT_MS } from "@/lib/weekly-plan/ai-client";
import { fixtureInputs, fixturePlan } from "../support/weekly-plan-fixtures";
const signal = () => new AbortController().signal;
const response = (definition: unknown = fixturePlan) => ({ status: "completed", model: "actual-model-snapshot", output: [], output_text: JSON.stringify(definition) });
const openai = (fn: ReturnType<typeof vi.fn>) => new OpenAIPlanClient({ responses: { create: fn } } as unknown as OpenAI);
const anthropic = (fn: ReturnType<typeof vi.fn>) => new AnthropicPlanClient({ messages: { create: fn } } as unknown as Anthropic);
describe("weekly plan correctness", () => {
  it("checks available days, exact totals, references and compatible activities", () => {
    expect(validatePlan(fixturePlan, fixtureInputs)).toEqual(fixturePlan);
    const mutate = (changes: object) => ({ ...fixturePlan, sessions: [{ ...fixturePlan.sessions[0], ...changes }, ...fixturePlan.sessions.slice(1)] });
    for (const invalid of [mutate({ day: "Monday" }), mutate({ minutes: 30 }), mutate({ minutes: 10 }), mutate({ minutes: 20.5 }), mutate({ resourceKey: "chapter:invented" }), mutate({ activity: "Endgames" }), mutate({ activity: "Own-game puzzles", resourceKey: null }), { ...fixturePlan, sessions: fixturePlan.sessions.slice(0, 1) }, { ...fixturePlan, promisedRatingGain: 100 }]) expect(() => validatePlan(invalid, fixtureInputs)).toThrow();
  });
  it("separates data from instructions and sends only finite catalog keys without URLs", () => {
    const prompt = buildPlanPrompt(fixtureInputs);
    expect(prompt.systemPrompt).toContain("never instructions"); expect(prompt.systemPrompt).toContain("Do not promise");
    expect(prompt.userMessage).toContain("chapter:chapter-1"); expect(prompt.userMessage).not.toContain("href");
    expect(prompt.responseSchema).toMatchObject({ type: "object", additionalProperties: false, required: ["schemaVersion", "title", "sessions"] });
  });
});
describe("weekly plan providers", () => {
  it("uses strict Responses JSON output, store:false, and records the response model", async () => {
    const create = vi.fn().mockResolvedValue(response());
    expect(await openai(create).generate(fixtureInputs, signal())).toEqual({ status: "OK", definition: fixturePlan, model: "actual-model-snapshot" });
    expect(create.mock.calls[0][0]).toMatchObject({ store: false, max_output_tokens: 4096, text: { format: { type: "json_schema", strict: true } } });
  });
  it("uses Anthropic structured output and records its actual model", async () => {
    const create = vi.fn().mockResolvedValue({ stop_reason: "end_turn", model: "actual-claude-model", content: [{ type: "text", text: JSON.stringify(fixturePlan) }] });
    expect(await anthropic(create).generate(fixtureInputs, signal())).toEqual({ status: "OK", definition: fixturePlan, model: "actual-claude-model" });
    expect(create.mock.calls[0][0]).toMatchObject({ max_tokens: 4096, output_config: { format: { type: "json_schema" } } });
  });
  it("replaces generated titles with neutral display text", async () => {
    const result = await openai(vi.fn().mockResolvedValue(response({ ...fixturePlan, title: "Guaranteed 200 rating points" }))).generate(fixtureInputs, signal());
    expect(result).toMatchObject({ status: "OK", definition: { title: "Weekly chess study" } });
  });
  it.each([
    { ...response(), output_text: "not json" },
    response({ ...fixturePlan, sessions: [{ ...fixturePlan.sessions[0], resourceKey: "invented" }] }),
    { ...response(), status: "incomplete" },
    { ...response(), output: [{ type: "message", content: [{ type: "refusal" }] }] },
  ])("rejects invalid, invented, incomplete and refused Responses output", async value => {
    expect(await openai(vi.fn().mockResolvedValue(value)).generate(fixtureInputs, signal())).toMatchObject({ status: "FAILED" });
  });
  it.each(["refusal", "max_tokens", "tool_use"])("rejects Anthropic stop reason %s", async stop_reason => {
    expect(await anthropic(vi.fn().mockResolvedValue({ stop_reason })).generate(fixtureInputs, signal())).toMatchObject({ status: "FAILED" });
  });
  it.each([
    new OpenAI.AuthenticationError(401, {}, "secret", new Headers()),
    new OpenAI.RateLimitError(429, {}, "secret", new Headers()),
    new OpenAI.APIConnectionTimeoutError({ message: "secret" }),
    new Anthropic.AuthenticationError(401, {}, "secret", new Headers()),
    new Anthropic.RateLimitError(429, {}, "secret", new Headers()),
    new Anthropic.APIConnectionError({ message: "secret" }),
    new Error("secret"),
  ])("sanitizes provider failures without revealing exception contents", async error => {
    const result = await openai(vi.fn().mockRejectedValue(error)).generate(fixtureInputs, signal());
    expect(result.status).toBe("FAILED"); expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("has no provider fallback and no request when a selected key is absent", async () => {
    vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("ANTHROPIC_API_KEY", "unused-test-key");
    try { expect(await createPlanClient("OPENAI").generate(fixtureInputs, signal())).toMatchObject({ status: "FAILED", message: expect.stringContaining("no API key") }); }
    finally { vi.unstubAllEnvs(); }
    expect(PLAN_TIMEOUT_MS).toBe(60000);
  });
});
