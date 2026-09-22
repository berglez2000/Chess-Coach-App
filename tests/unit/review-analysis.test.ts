import { expect, it } from "vitest";
import { toReviewAnalysis } from "@/lib/analysis/review";
it("treats missing and unsupported saved assessment versions as unavailable", () => {
  expect(toReviewAnalysis(null)).toBeNull();
  expect(toReviewAnalysis({ assessment: { policyVersion: 2 }, bestMoveSan: null, pvSan: [], runId: "run", analyzedAt: new Date() })).toBeNull();
});
