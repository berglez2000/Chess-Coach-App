import { expect, it, describe } from "vitest";
import {
  coachingResponseSchema,
  crossCheckCoachingResponse,
  COACHING_CATEGORIES,
  COACHING_CLASSIFICATIONS,
  type RawCoachingResponse,
  type CrossCheckInput,
} from "@/lib/coaching/contract";
import type { MoveQuality } from "@/types/analysis";

function validResponse(overrides: Partial<RawCoachingResponse> = {}): RawCoachingResponse {
  return {
    schemaVersion: 1,
    summary: "You handled the opening well but attacked before finishing development.",
    strengths: ["Central control"],
    improvements: ["Complete development before attacking"],
    criticalMoments: [
      {
        ply: 15,
        classification: "mistake",
        headline: "Premature queen attack",
        explanation: "Qf3 placed the queen where Black could gain time attacking it.",
        lesson: "Finish development before committing the queen.",
        category: "opening.development",
      },
    ],
    ...overrides,
  };
}

function defaultInput(overrides: Partial<CrossCheckInput> = {}): CrossCheckInput {
  return {
    response: validResponse(),
    gamePlies: new Set([1, 2, 3, 14, 15, 16, 30]),
    selectedPlies: new Set([15]),
    engineQuality: new Map<number, MoveQuality>([[15, "mistake"]]),
    model: "gpt-4o-2024-08-06",
    ...overrides,
  };
}

describe("coachingResponseSchema — valid", () => {
  it("accepts a minimal valid response", () => {
    const result = coachingResponseSchema.safeParse(validResponse());
    expect(result.success).toBe(true);
  });

  it("accepts empty strengths, improvements, and criticalMoments", () => {
    const result = coachingResponseSchema.safeParse(
      validResponse({ strengths: [], improvements: [], criticalMoments: [] })
    );
    expect(result.success).toBe(true);
  });

  it("accepts null headline", () => {
    const resp = validResponse();
    resp.criticalMoments[0].headline = null;
    expect(coachingResponseSchema.safeParse(resp).success).toBe(true);
  });

  it("accepts all allowed categories", () => {
    for (const category of COACHING_CATEGORIES) {
      const resp = validResponse();
      resp.criticalMoments[0].category = category;
      expect(coachingResponseSchema.safeParse(resp).success).toBe(true);
    }
  });

  it("accepts all allowed classifications", () => {
    for (const classification of COACHING_CLASSIFICATIONS) {
      const resp = validResponse();
      resp.criticalMoments[0].classification = classification;
      expect(coachingResponseSchema.safeParse(resp).success).toBe(true);
    }
  });
});

describe("coachingResponseSchema — invalid", () => {
  it("rejects wrong schemaVersion", () => {
    expect(coachingResponseSchema.safeParse({ ...validResponse(), schemaVersion: 2 }).success).toBe(false);
    expect(coachingResponseSchema.safeParse({ ...validResponse(), schemaVersion: 0 }).success).toBe(false);
  });

  it("rejects empty summary", () => {
    expect(coachingResponseSchema.safeParse(validResponse({ summary: "" })).success).toBe(false);
  });

  it("rejects summary exceeding 500 chars", () => {
    expect(coachingResponseSchema.safeParse(validResponse({ summary: "x".repeat(501) })).success).toBe(false);
  });

  it("rejects strengths list exceeding 5 items", () => {
    expect(coachingResponseSchema.safeParse(
      validResponse({ strengths: ["a", "b", "c", "d", "e", "f"] })
    ).success).toBe(false);
  });

  it("rejects improvements list exceeding 5 items", () => {
    expect(coachingResponseSchema.safeParse(
      validResponse({ improvements: ["a", "b", "c", "d", "e", "f"] })
    ).success).toBe(false);
  });

  it("rejects criticalMoments exceeding 10 items", () => {
    const moments = Array.from({ length: 11 }, (_, i) => ({
      ply: i + 1,
      classification: "mistake" as const,
      headline: null,
      explanation: "x".repeat(10),
      lesson: "y".repeat(10),
      category: "other" as const,
    }));
    expect(coachingResponseSchema.safeParse(validResponse({ criticalMoments: moments })).success).toBe(false);
  });

  it("rejects unknown category", () => {
    const resp = validResponse();
    (resp.criticalMoments[0] as Record<string, unknown>).category = "development";
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
  });

  it("rejects unknown classification", () => {
    const resp = validResponse();
    (resp.criticalMoments[0] as Record<string, unknown>).classification = "brilliant";
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
  });

  it("rejects 'unknown' as classification (only valid internally)", () => {
    const resp = validResponse();
    (resp.criticalMoments[0] as Record<string, unknown>).classification = "unknown";
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
  });

  it("rejects empty explanation", () => {
    const resp = validResponse();
    resp.criticalMoments[0].explanation = "";
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
  });

  it("rejects explanation exceeding 600 chars", () => {
    const resp = validResponse();
    resp.criticalMoments[0].explanation = "x".repeat(601);
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
  });

  it("rejects lesson exceeding 400 chars", () => {
    const resp = validResponse();
    resp.criticalMoments[0].lesson = "x".repeat(401);
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
  });

  it("rejects headline exceeding 100 chars", () => {
    const resp = validResponse();
    resp.criticalMoments[0].headline = "x".repeat(101);
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
  });

  it("rejects non-positive or non-integer ply", () => {
    const resp = validResponse();
    resp.criticalMoments[0].ply = 0;
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
    resp.criticalMoments[0].ply = -5;
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
    resp.criticalMoments[0].ply = 1.5;
    expect(coachingResponseSchema.safeParse(resp).success).toBe(false);
  });
});

describe("crossCheckCoachingResponse — valid", () => {
  it("returns ok=true and a well-formed annotation for valid input", () => {
    const { result, annotation } = crossCheckCoachingResponse(defaultInput());
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(annotation).not.toBeNull();
    expect(annotation!.schemaVersion).toBe(1);
    expect(annotation!.moments).toHaveLength(1);
    expect(annotation!.model).toBe("gpt-4o-2024-08-06");
  });

  it("maps summary, strengths, improvements into annotation", () => {
    const { annotation } = crossCheckCoachingResponse(defaultInput());
    expect(annotation!.summary).toBe(validResponse().summary);
    expect(annotation!.strengths).toEqual(["Central control"]);
    expect(annotation!.improvements).toEqual(["Complete development before attacking"]);
  });

  it("preserves all moment fields", () => {
    const { annotation } = crossCheckCoachingResponse(defaultInput());
    const moment = annotation!.moments[0];
    expect(moment.ply).toBe(15);
    expect(moment.headline).toBe("Premature queen attack");
    expect(moment.category).toBe("opening.development");
    expect(moment.explanation).toContain("queen");
    expect(moment.lesson).toContain("development");
  });

  it("works with empty criticalMoments", () => {
    const { result, annotation } = crossCheckCoachingResponse(
      defaultInput({ response: validResponse({ criticalMoments: [] }) })
    );
    expect(result.ok).toBe(true);
    expect(annotation!.moments).toHaveLength(0);
  });
});

describe("crossCheckCoachingResponse — unknown ply", () => {
  it("rejects a ply not present in the game", () => {
    const resp = validResponse();
    resp.criticalMoments[0].ply = 999;
    const { result, annotation } = crossCheckCoachingResponse(
      defaultInput({ response: resp })
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("UNKNOWN_PLY");
    expect(result.errors[0].ply).toBe(999);
    expect(annotation).toBeNull();
  });
});

describe("crossCheckCoachingResponse — unselected ply", () => {
  it("rejects a ply in the game but not in selectedPlies", () => {
    const resp = validResponse();
    resp.criticalMoments[0].ply = 14; // in gamePlies but not selectedPlies
    const { result, annotation } = crossCheckCoachingResponse(
      defaultInput({ response: resp })
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("UNSELECTED_PLY");
    expect(result.errors[0].ply).toBe(14);
    expect(annotation).toBeNull();
  });
});

describe("crossCheckCoachingResponse — duplicate ply", () => {
  it("rejects duplicate plies in criticalMoments", () => {
    const resp = validResponse({
      criticalMoments: [
        { ply: 15, classification: "mistake", headline: null, explanation: "First", lesson: "Lesson one", category: "other" },
        { ply: 15, classification: "blunder", headline: null, explanation: "Second", lesson: "Lesson two", category: "other" },
      ],
    });
    const { result, annotation } = crossCheckCoachingResponse(
      defaultInput({ response: resp, selectedPlies: new Set([15]) })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === "DUPLICATE_PLY" && e.ply === 15)).toBe(true);
    expect(annotation).toBeNull();
  });
});

describe("crossCheckCoachingResponse — classification normalization", () => {
  it("uses engine quality when available and non-unknown, ignoring model claim", () => {
    const resp = validResponse();
    resp.criticalMoments[0].classification = "blunder"; // model says blunder
    const engineQuality = new Map<number, MoveQuality>([[15, "inaccuracy"]]); // engine says inaccuracy
    const { annotation } = crossCheckCoachingResponse(defaultInput({ response: resp, engineQuality }));
    const moment = annotation!.moments[0];
    expect(moment.engineQuality).toBe("inaccuracy");
    expect(moment.modelClassification).toBe("blunder");
    expect(moment.effectiveClassification).toBe("inaccuracy"); // engine wins
  });

  it("uses model classification when engine quality is unknown", () => {
    const engineQuality = new Map<number, MoveQuality>([[15, "unknown"]]);
    const { annotation } = crossCheckCoachingResponse(defaultInput({ engineQuality }));
    const moment = annotation!.moments[0];
    expect(moment.engineQuality).toBe("unknown");
    expect(moment.effectiveClassification).toBe("mistake"); // model's value used
  });

  it("uses model classification when no engine quality is present for the ply", () => {
    const { annotation } = crossCheckCoachingResponse(
      defaultInput({ engineQuality: new Map() })
    );
    const moment = annotation!.moments[0];
    expect(moment.engineQuality).toBeNull();
    expect(moment.effectiveClassification).toBe("mistake"); // model's value used
  });

  it("preserves engine quality=normal, overriding model mistake", () => {
    const resp = validResponse();
    resp.criticalMoments[0].classification = "mistake";
    const engineQuality = new Map<number, MoveQuality>([[15, "normal"]]);
    const { annotation } = crossCheckCoachingResponse(defaultInput({ response: resp, engineQuality }));
    expect(annotation!.moments[0].effectiveClassification).toBe("normal");
  });
});

describe("crossCheckCoachingResponse — multiple errors accumulate before rejection", () => {
  it("reports all errors when multiple plies are invalid", () => {
    const resp = validResponse({
      criticalMoments: [
        { ply: 999, classification: "mistake", headline: null, explanation: "A", lesson: "B", category: "other" },
        { ply: 14, classification: "blunder", headline: null, explanation: "C", lesson: "D", category: "other" },
      ],
    });
    const { result } = crossCheckCoachingResponse(defaultInput({ response: resp }));
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map(e => e.code)).toContain("UNKNOWN_PLY");
    expect(result.errors.map(e => e.code)).toContain("UNSELECTED_PLY");
  });
});
