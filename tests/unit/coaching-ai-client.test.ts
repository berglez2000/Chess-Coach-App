import { expect, it, vi, describe, beforeEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicCoachingClient, COACHING_MODEL, type CoachingRequest } from "@/lib/coaching/ai-client";
import type { RawCoachingResponse } from "@/lib/coaching/contract";

// Minimal valid payload — tests don't exercise prompt building.
function makeRequest(overrides: Partial<CoachingRequest> = {}): CoachingRequest {
  return {
    payload: {
      systemPrompt: "You are a chess coach.",
      userMessage: "Review this game.",
      responseSchema: { type: "object" },
    },
    gamePlies: new Set([15]),
    selectedPlies: new Set([15]),
    engineQuality: new Map([[15, "mistake"]]),
    ...overrides,
  };
}

const VALID_RESPONSE: RawCoachingResponse = {
  schemaVersion: 1,
  summary: "Good opening, missed endgame technique.",
  strengths: ["Central control"],
  improvements: ["Activate the king in endgames"],
  criticalMoments: [
    {
      ply: 15,
      classification: "mistake",
      headline: "Missed fork",
      explanation: "Moving the bishop allowed a knight fork on d4 winning a pawn.",
      lesson: "Look for knight forks before committing pieces to passive squares.",
      category: "tactics.fork",
    },
  ],
};

function mockSuccessResponse(data: object = VALID_RESPONSE) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: COACHING_MODEL,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

function makeClient(createMock: ReturnType<typeof vi.fn>) {
  const sdk = { messages: { create: createMock } } as unknown as Anthropic;
  return new AnthropicCoachingClient(sdk);
}

describe("AnthropicCoachingClient", () => {
  let createMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMock = vi.fn();
  });

  it("returns OK annotation for valid structured response", async () => {
    createMock.mockResolvedValue(mockSuccessResponse());
    const result = await makeClient(createMock).requestCoaching(makeRequest());
    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.annotation.summary).toBe(VALID_RESPONSE.summary);
    expect(result.annotation.model).toBe(COACHING_MODEL);
    expect(result.annotation.moments).toHaveLength(1);
    expect(result.annotation.moments[0].ply).toBe(15);
  });

  it("passes model to annotation metadata", async () => {
    createMock.mockResolvedValue({ ...mockSuccessResponse(), model: "claude-haiku-4-5" });
    const result = await makeClient(createMock).requestCoaching(makeRequest({ model: "claude-haiku-4-5" }));
    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.annotation.model).toBe("claude-haiku-4-5");
  });

  it("sends structured output config with responseSchema", async () => {
    createMock.mockResolvedValue(mockSuccessResponse());
    await makeClient(createMock).requestCoaching(makeRequest());
    const call = createMock.mock.calls[0][0];
    expect(call.output_config?.format?.type).toBe("json_schema");
    expect(call.output_config?.format?.schema).toEqual({ type: "object" });
  });

  it("uses COACHING_MODEL as default", async () => {
    createMock.mockResolvedValue(mockSuccessResponse());
    await makeClient(createMock).requestCoaching(makeRequest());
    expect(createMock.mock.calls[0][0].model).toBe(COACHING_MODEL);
  });

  it("returns REFUSAL when stop_reason is refusal", async () => {
    createMock.mockResolvedValue({ ...mockSuccessResponse(), stop_reason: "refusal", content: [] });
    expect(await makeClient(createMock).requestCoaching(makeRequest())).toEqual({ status: "REFUSAL" });
  });

  it("returns INCOMPLETE_OUTPUT when stop_reason is max_tokens", async () => {
    createMock.mockResolvedValue({ ...mockSuccessResponse(), stop_reason: "max_tokens" });
    expect(await makeClient(createMock).requestCoaching(makeRequest())).toEqual({ status: "INCOMPLETE_OUTPUT" });
  });

  it("returns MISSING_KEY on AuthenticationError", async () => {
    createMock.mockRejectedValue(new Anthropic.AuthenticationError(401, { error: { type: "authentication_error", message: "invalid key" } }, "invalid key", new Headers()));
    expect(await makeClient(createMock).requestCoaching(makeRequest())).toEqual({ status: "MISSING_KEY" });
  });

  it("returns RATE_LIMIT on RateLimitError", async () => {
    createMock.mockRejectedValue(new Anthropic.RateLimitError(429, { error: { type: "rate_limit_error", message: "rate limit" } }, "rate limit", new Headers()));
    expect(await makeClient(createMock).requestCoaching(makeRequest())).toEqual({ status: "RATE_LIMIT" });
  });

  it("returns TIMEOUT on APIConnectionError", async () => {
    const connErr = new Anthropic.APIConnectionError({ message: "connection timeout", cause: undefined });
    createMock.mockRejectedValue(connErr);
    expect(await makeClient(createMock).requestCoaching(makeRequest())).toEqual({ status: "TIMEOUT" });
  });

  it("returns API_ERROR on InternalServerError", async () => {
    createMock.mockRejectedValue(new Anthropic.InternalServerError(500, { error: { type: "api_error", message: "server error" } }, "server error", new Headers()));
    const result = await makeClient(createMock).requestCoaching(makeRequest());
    expect(result.status).toBe("API_ERROR");
  });

  it("returns INVALID_RESPONSE when content has no text block", async () => {
    createMock.mockResolvedValue({ ...mockSuccessResponse(), content: [] });
    const result = await makeClient(createMock).requestCoaching(makeRequest());
    expect(result.status).toBe("INVALID_RESPONSE");
  });

  it("returns INVALID_RESPONSE when response is not valid JSON", async () => {
    createMock.mockResolvedValue({ ...mockSuccessResponse(), content: [{ type: "text", text: "not json{" }] });
    const result = await makeClient(createMock).requestCoaching(makeRequest());
    expect(result.status).toBe("INVALID_RESPONSE");
  });

  it("returns INVALID_RESPONSE when response fails Zod schema", async () => {
    createMock.mockResolvedValue(mockSuccessResponse({ schemaVersion: 2, summary: "x" }));
    const result = await makeClient(createMock).requestCoaching(makeRequest());
    expect(result.status).toBe("INVALID_RESPONSE");
  });

  it("returns INVALID_RESPONSE when model cites ply not in selectedPlies", async () => {
    const badResponse: RawCoachingResponse = {
      ...VALID_RESPONSE,
      criticalMoments: [{ ...VALID_RESPONSE.criticalMoments[0], ply: 99 }],
    };
    createMock.mockResolvedValue(mockSuccessResponse(badResponse));
    const result = await makeClient(createMock).requestCoaching(makeRequest());
    expect(result.status).toBe("INVALID_RESPONSE");
  });

  it("rethrows unknown errors", async () => {
    createMock.mockRejectedValue(new TypeError("unexpected"));
    await expect(makeClient(createMock).requestCoaching(makeRequest())).rejects.toThrow("unexpected");
  });
});
