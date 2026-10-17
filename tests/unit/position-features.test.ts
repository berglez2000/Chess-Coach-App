import { describe, expect, it } from "vitest";
import { describePositionFeatures, extractPositionFeatures } from "@/lib/coaching/position-features";

describe("extractPositionFeatures", () => {
  it("reports level material and castled-free kings in the start position", () => {
    const f = extractPositionFeatures("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")!;
    expect(f.materialBalance).toBe(0);
    expect(f.white.material).toEqual({ points: 39, summary: "Q, 2R, 2B, 2N, 8P" });
    expect(f.white.loosePieces).toEqual([]);
    expect(f.white.king).toMatchObject({ square: "e1", castled: false, pawnShield: 3, openFilesNearKing: [], inCheck: false });
  });

  it("finds an undefended attacked piece and a piece attacked by a cheaper one", () => {
    // White knight on e5 attacked by the d6 pawn; Black bishop on b4 attacked by a3 pawn but defended by c5 pawn.
    const f = extractPositionFeatures("4k3/8/3p4/2p1N3/1b6/P7/8/4K3 w - - 0 1")!;
    expect(f.white.loosePieces).toEqual([
      { square: "e5", piece: "knight on e5", reason: "undefended" },
      { square: "a3", piece: "pawn on a3", reason: "undefended" },
    ]);
    expect(f.black.loosePieces).toEqual([{ square: "b4", piece: "bishop on b4", reason: "attacked by a cheaper piece" }]);
  });

  it("describes a castled king with open files and a check", () => {
    const f = extractPositionFeatures("6k1/5ppp/8/8/8/8/5P1P/4r1K1 w - - 0 1")!;
    expect(f.white.king).toMatchObject({ square: "g1", castled: true, pawnShield: 2, openFilesNearKing: ["g"], inCheck: true });
  });

  it("returns null for an invalid FEN", () => {
    expect(extractPositionFeatures("not a fen")).toBeNull();
  });
});

describe("describePositionFeatures", () => {
  it("phrases material from the mover's point of view", () => {
    const f = extractPositionFeatures("4k3/8/8/8/8/8/8/R3K3 w - - 0 1")!;
    expect(describePositionFeatures(f, "WHITE")[0]).toContain("mover is up 5 points");
    expect(describePositionFeatures(f, "BLACK")[0]).toContain("mover is down 5 points");
  });
});
