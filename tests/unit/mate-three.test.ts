import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import exercises from "../../data/learning/mate-in-three.json";
import { contentSchema, validateContent } from "../../lib/learning/content";
function replay(fen: string, line: string) {
  const board = new Chess(fen);
  for (const san of line.split(" ")) expect(board.move(san, { strict: true }).san).toBe(san);
  return board;
}
describe("Mate in 3 chapter", () => {
  it("covers all 81 source diagrams in order with page references", () => {
    expect(exercises.map(row => row.order)).toEqual(Array.from({ length: 81 }, (_, i) => 865 + i));
    for (const row of exercises) {
      const page = row.order < 874 ? 109 : 110 + Math.floor((row.order - 874) / 12);
      const content = contentSchema.parse(row.content);
      expect(row.number).toBe(String(row.order));
      expect(content.objective).toBe("MATE");
      expect(content.mateIn).toBe(3);
      expect(content.solver).toBe("WHITE");
      expect(new Chess(content.fen).turn()).toBe("w");
      expect(content.diagramPage).toBe(String(page));
      expect(content.pdfPage).toBe(page - 10);
      expect(content.answerPage).toBe(String(row.order < 872 ? 140 : row.order < 935 ? 141 : 142));
    }
  });
  it.each(exercises)("checks every solution and source branch for $number", row => {
    expect(replay(row.content.fen, row.content.solutionText).isCheckmate()).toBe(true);
    expect(row.content.solutionText.split(" ").length).toBeLessThanOrEqual(5);
    for (const line of row.bookLines) expect(replay(row.content.fen, line).isCheckmate()).toBe(row.number !== "898");
  });
  it("completes the truncated answer for 898 and preserves the failed try for 943", () => {
    const truncated = exercises.find(row => row.order === 898)!;
    expect(truncated.bookLines).toEqual(["Rxb6+ Qxc6 Rxa2+"]);
    expect(truncated.content.solutionText).toBe("Rxb6+ Qxc6 Rxa2+ Qa4 Rxa4#");
    const failedTry = exercises.find(row => row.order === 943)!;
    expect(replay(failedTry.content.fen, failedTry.analysisLines![0]).isCheckmate()).toBe(false);
  });
  it.each([880, 890, 895])("proves mate against every defense for %i", number => {
    expect(validateContent(exercises.find(row => row.order === number)!.content).method).toBe("exhaustive-forced-mate-v1");
  });
});
