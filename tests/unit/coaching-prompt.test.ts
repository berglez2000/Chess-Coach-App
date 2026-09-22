import { expect, it, describe } from "vitest";
import { parsePgn } from "@/lib/pgn/parse";
import { buildCoachingPrompt, type CoachingPromptInput, type MomentFacts } from "@/lib/coaching/prompt";
import { COACHING_CATEGORIES, COACHING_CLASSIFICATIONS } from "@/lib/coaching/contract";
import type { SelectedMoment } from "@/lib/coaching/select-moments";
import type { NormalizedEvaluation } from "@/types/analysis";
import type { ChessColor } from "@/types/game";

const pgn = `[White "Alice"] [Black "Bob"] [Result "1-0"] [Date "2024.01.15"]
[Event "Club Game"] [ECO "C60"] [Opening "Ruy Lopez"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6
8. c3 O-O 9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Nc6
14. Nb3 a5 15. Be3 a4 16. Nbd2 Bd7 17. Nf1 Rfc8 18. Ng3 1-0`;

const parsed = parsePgn(pgn);
const moves = parsed.moves;
const meta = parsed.metadata;

function makeEval(cp: number, depth = 12): NormalizedEvaluation {
  return {
    perspective: "WHITE",
    depth,
    pv: [],
    score: { kind: "cp", value: cp, bound: "exact" },
  };
}

function makeMateEval(dist: number, winner: ChessColor, depth = 12): NormalizedEvaluation {
  return {
    perspective: "WHITE",
    depth,
    pv: [],
    score: { kind: "mate", value: winner === "WHITE" ? dist : -dist, winner, bound: "exact" },
  };
}

function makeFacts(plyIndex: number, overrides: Partial<MomentFacts> = {}): MomentFacts {
  const move = moves[plyIndex];
  return {
    ply: move.ply,
    san: move.san,
    uci: move.uci,
    mover: move.color,
    fenBefore: move.fenBefore,
    fenAfter: move.fenAfter,
    before: makeEval(30),
    after: makeEval(-70),
    bestMoveSan: "Nf3",
    bestMoveUci: "g1f3",
    pvSan: ["Nf3", "Nc6"],
    ...overrides,
  };
}

function makeSelectedMoment(plyIndex: number): SelectedMoment {
  const move = moves[plyIndex];
  return {
    ply: move.ply,
    san: move.san,
    mover: move.color,
    kind: "user_loss",
    evidence: [{ code: "evaluation_loss", cpLoss: 100, before: { kind: "cp", value: 30, bound: "exact" }, after: { kind: "cp", value: -70, bound: "exact" } }],
  };
}

function makeInput(overrides: Partial<CoachingPromptInput> = {}): CoachingPromptInput {
  const moment = makeSelectedMoment(9); // ply 10
  const facts = makeFacts(9);
  return {
    userColor: "WHITE",
    game: { metadata: meta },
    moments: [moment],
    momentFacts: new Map([[moment.ply, facts]]),
    ...overrides,
  };
}

describe("buildCoachingPrompt — structure", () => {
  it("returns systemPrompt, userMessage, and responseSchema", () => {
    const { systemPrompt, userMessage, responseSchema } = buildCoachingPrompt(makeInput());
    expect(typeof systemPrompt).toBe("string");
    expect(systemPrompt.length).toBeGreaterThan(50);
    expect(typeof userMessage).toBe("string");
    expect(userMessage.length).toBeGreaterThan(50);
    expect(responseSchema).toBeDefined();
    expect(typeof responseSchema).toBe("object");
  });

  it("responseSchema contains all required fields and constraints", () => {
    const { responseSchema } = buildCoachingPrompt(makeInput());
    const schema = responseSchema as Record<string, unknown>;
    expect((schema.properties as Record<string, unknown>)).toHaveProperty("schemaVersion");
    expect((schema.properties as Record<string, unknown>)).toHaveProperty("criticalMoments");
    expect((schema.properties as Record<string, unknown>)).toHaveProperty("summary");
    expect(schema.required).toEqual(expect.arrayContaining(["schemaVersion", "summary", "strengths", "improvements", "criticalMoments"]));
  });

  it("responseSchema includes all COACHING_CATEGORIES and COACHING_CLASSIFICATIONS", () => {
    const { responseSchema } = buildCoachingPrompt(makeInput());
    const schema = responseSchema as { properties: { criticalMoments: { items: { properties: { category: { enum: string[] }; classification: { enum: string[] } } } } } };
    const cats = schema.properties.criticalMoments.items.properties.category.enum;
    const classes = schema.properties.criticalMoments.items.properties.classification.enum;
    for (const cat of COACHING_CATEGORIES) expect(cats).toContain(cat);
    for (const cls of COACHING_CLASSIFICATIONS) expect(classes).toContain(cls);
  });
});

describe("buildCoachingPrompt — user color", () => {
  it.each(["WHITE", "BLACK"] as const)("includes correct user color label for %s", userColor => {
    const { userMessage } = buildCoachingPrompt(makeInput({ userColor }));
    const label = userColor === "WHITE" ? "White" : "Black";
    expect(userMessage).toContain(`User's color: ${label}`);
  });

  it.each(["WHITE", "BLACK"] as const)("labels mover correctly in moment block for %s", userColor => {
    // pick a ply where the mover matches userColor
    const plyIndex = userColor === "WHITE" ? 0 : 1; // ply 1 = White, ply 2 = Black
    const moment = makeSelectedMoment(plyIndex);
    const facts = makeFacts(plyIndex);
    const { userMessage } = buildCoachingPrompt({
      userColor,
      game: { metadata: meta },
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain(`User is playing: ${userColor === "WHITE" ? "White" : "Black"}`);
  });
});

describe("buildCoachingPrompt — selected plies and FENs", () => {
  it("embeds the correct ply number for each selected moment", () => {
    const moment = makeSelectedMoment(9);
    const facts = makeFacts(9);
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain(`Ply ${moment.ply}`);
  });

  it("embeds fenBefore and fenAfter from the moment facts", () => {
    const moment = makeSelectedMoment(9);
    const facts = makeFacts(9);
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain(facts.fenBefore);
    expect(userMessage).toContain(facts.fenAfter);
  });

  it("includes all selected plies when multiple moments provided", () => {
    const m1 = makeSelectedMoment(4);  // ply 5
    const m2 = makeSelectedMoment(10); // ply 11
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [m1, m2],
      momentFacts: new Map([[m1.ply, makeFacts(4)], [m2.ply, makeFacts(10)]]),
    });
    expect(userMessage).toContain(`Ply ${m1.ply}`);
    expect(userMessage).toContain(`Ply ${m2.ply}`);
  });

  it("only includes supplied moment plies — not all game plies", () => {
    const moment = makeSelectedMoment(9);
    const facts = makeFacts(9);
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    // Other plies from game should not appear as moment headers
    expect(userMessage).not.toContain(`Ply 1 —`);
    expect(userMessage).not.toContain(`Ply 2 —`);
  });
});

describe("buildCoachingPrompt — score perspective", () => {
  it("labels evaluations as White perspective", () => {
    const { userMessage } = buildCoachingPrompt(makeInput());
    expect(userMessage).toContain("White perspective");
  });

  it("renders positive cp as +X.XX for a White-favorable position", () => {
    const moment = makeSelectedMoment(0);
    const facts = makeFacts(0, { before: makeEval(150), after: makeEval(30) });
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain("+1.50");
    expect(userMessage).toContain("+0.30");
  });

  it("renders negative cp correctly for a Black-favorable position", () => {
    const moment = makeSelectedMoment(1);
    const facts = makeFacts(1, { before: makeEval(-80), after: makeEval(-200) });
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain("-0.80");
    expect(userMessage).toContain("-2.00");
  });
});

describe("buildCoachingPrompt — mate representation", () => {
  it("renders mate-in-N for winning side", () => {
    const moment = makeSelectedMoment(0);
    const facts = makeFacts(0, { after: makeMateEval(3, "WHITE") });
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain("mate in 3");
  });

  it("renders mated-in-N for losing side", () => {
    const moment = makeSelectedMoment(0);
    const facts = makeFacts(0, { after: makeMateEval(2, "BLACK") });
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain("mated in 2");
  });

  it("does not render cp numbers for mate scores", () => {
    const moment = makeSelectedMoment(0);
    const facts = makeFacts(0, { after: makeMateEval(3, "WHITE") });
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    // Should not see something like "30000.00" from a raw mate value
    expect(userMessage).not.toMatch(/\d{4,}\.\d{2}/);
  });
});

describe("buildCoachingPrompt — engine best move and PV", () => {
  it("includes bestMoveSan and pvSan when available", () => {
    const moment = makeSelectedMoment(9);
    const facts = makeFacts(9, { bestMoveSan: "Qd5", bestMoveUci: "d1d5", pvSan: ["Qd5", "Nf6", "Bxf6"] });
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain("Qd5");
    expect(userMessage).toContain("d1d5");
    expect(userMessage).toContain("Bxf6");
  });

  it("reports unavailable when bestMove is null", () => {
    const moment = makeSelectedMoment(9);
    const facts = makeFacts(9, { bestMoveSan: null, bestMoveUci: null, pvSan: [] });
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [moment],
      momentFacts: new Map([[moment.ply, facts]]),
    });
    expect(userMessage).toContain("Engine best move: unavailable");
  });
});

describe("buildCoachingPrompt — missing optional metadata", () => {
  it("omits absent metadata fields without error", () => {
    const minimalMeta = {
      whiteName: null, blackName: null, result: "*" as const,
      playedAt: null, event: null, site: null, round: null,
      openingName: null, eco: null, timeControl: null, termination: null,
    };
    const { userMessage } = buildCoachingPrompt({
      ...makeInput(),
      game: { metadata: minimalMeta },
    });
    expect(userMessage).toContain("User's color:");
    expect(userMessage).not.toContain("White player:");
    expect(userMessage).not.toContain("Opening:");
    expect(userMessage).not.toContain("Event:");
  });

  it("includes metadata when present", () => {
    const { userMessage } = buildCoachingPrompt(makeInput());
    expect(userMessage).toContain("Alice");
    expect(userMessage).toContain("Bob");
    expect(userMessage).toContain("Ruy Lopez");
  });
});

describe("buildCoachingPrompt — zero moments", () => {
  it("produces a valid payload with no moments", () => {
    const { systemPrompt, userMessage } = buildCoachingPrompt({
      ...makeInput(),
      moments: [],
      momentFacts: new Map(),
    });
    expect(systemPrompt.length).toBeGreaterThan(0);
    expect(userMessage).toContain("No moments were selected");
    expect(userMessage).toContain("empty criticalMoments");
  });
});

describe("buildCoachingPrompt — safety", () => {
  it("throws when facts are missing for a selected moment", () => {
    const moment = makeSelectedMoment(9);
    expect(() =>
      buildCoachingPrompt({
        ...makeInput(),
        moments: [moment],
        momentFacts: new Map(), // no facts provided
      })
    ).toThrow(/Missing engine facts/);
  });

  it("system prompt forbids inventing engine facts", () => {
    const { systemPrompt } = buildCoachingPrompt(makeInput());
    expect(systemPrompt).toContain("authoritative");
    expect(systemPrompt).toContain("Do not invent");
  });

  it("system prompt references the supplied data constraint for alternative moves", () => {
    const { systemPrompt } = buildCoachingPrompt(makeInput());
    expect(systemPrompt).toContain("supplied engine data");
  });
});
