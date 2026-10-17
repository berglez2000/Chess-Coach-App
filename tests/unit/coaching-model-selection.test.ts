import { afterEach, expect, it, vi } from "vitest";
const { claudeCreate, openaiCreate } = vi.hoisted(() => ({ claudeCreate: vi.fn(), openaiCreate: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: claudeCreate }; } }));
vi.mock("openai", () => ({ default: class { responses = { create: openaiCreate }; } }));
import { createCoachingClient, type CoachingRequest } from "@/lib/coaching/ai-client";
import { createPlanClient } from "@/lib/weekly-plan/ai-client";
import { COACHING_MODELS, type CoachingProvider } from "@/lib/coaching/providers";
import { fixtureInputs } from "../support/weekly-plan-fixtures";

afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
const choices = (Object.keys(COACHING_MODELS) as CoachingProvider[]).flatMap(provider =>
  COACHING_MODELS[provider].map(model => ({ provider, model: model.id })));
const request: CoachingRequest = {
  payload: { systemPrompt: "Coach", userMessage: "Facts", responseSchema: { type: "object" } },
  gamePlies: new Set(), selectedPlies: new Set(), engineQuality: new Map(),
};

it.each(choices)("routes $provider/$model to the correct SDK for coaching and plans", async ({ provider, model }) => {
  vi.stubEnv("ANTHROPIC_API_KEY", "fixture"); vi.stubEnv("OPENAI_API_KEY", "fixture"); vi.stubEnv("DEEPSEEK_API_KEY", "fixture");
  claudeCreate.mockResolvedValue({ stop_reason: "max_tokens" });
  openaiCreate.mockResolvedValue({ status: "incomplete", output: [] });
  expect(await createCoachingClient(provider, model).requestCoaching(request)).toMatchObject({ status: "INCOMPLETE_OUTPUT" });
  expect(await createPlanClient(provider, model).generate(fixtureInputs, new AbortController().signal)).toMatchObject({ status: "FAILED" });
  const selected = provider === "ANTHROPIC" ? claudeCreate : openaiCreate;
  const other = provider === "ANTHROPIC" ? openaiCreate : claudeCreate;
  expect(selected).toHaveBeenCalledTimes(2);
  for (const [body] of selected.mock.calls) expect(body).toMatchObject({ model });
  expect(other).not.toHaveBeenCalled();
});

it("rejects mismatched models before either SDK is called", () => {
  expect(() => createCoachingClient("OPENAI", "claude-opus-4-6")).toThrow();
  expect(() => createPlanClient("ANTHROPIC", "gpt-5.4")).toThrow();
  expect(claudeCreate).not.toHaveBeenCalled(); expect(openaiCreate).not.toHaveBeenCalled();
});
