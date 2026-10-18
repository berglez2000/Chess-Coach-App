import { describe, expect, it } from "vitest";
import { pgnGameDetails, pgnReviewMetadata } from "@/lib/pgn/review-metadata";

const chessCom = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.18"]
[Result "0-1"]
[ECO "E00"]
[ECOUrl "https://www.chess.com/openings/Indian-Game-East-Indian-Seirawan-Attack"]
[WhiteElo "759"]
[BlackElo "764"]
[TimeControl "600"]
[Termination "aberglez2000 won by resignation"]
[StartTime "12:17:51"]
[EndDate "2026.10.18"]
[EndTime "12:31:29"]
[Link "https://www.chess.com/analysis/game/live/185525366162/analysis?flip=true"]

1. d4 Nf6 2. c4 e6 3. Bg5 d5 4. e3 Be7 5. Nc3 O-O 6. cxd5 exd5 7. Nf3 h6 8. Bh4
c5 9. dxc5 Bxc5 10. Nxd5 $4 Qxd5 11. Bxf6 Qxd1+ $1 12. Rxd1 gxf6 13. Nh4 Bg4 $9 0-1`;

describe("pgnReviewMetadata", () => {
  it("collects headers and standard move-assessment NAGs by ply", () => {
    const meta = pgnReviewMetadata(chessCom);
    expect(meta.headers.Termination).toBe("aberglez2000 won by resignation");
    expect(meta.annotations).toEqual({ 19: "??", 22: "!" });
  });

  it("reads suffix annotations and comments without clock commands", () => {
    const meta = pgnReviewMetadata(`1. e4 { [%clk 0:09:58] Good start. } e5?! 2. Qh5 { [%clk 0:09:50] } *`);
    expect(meta.annotations).toEqual({ 2: "?!" });
    expect(meta.comments).toEqual({ 1: "Good start." });
    expect(meta.clocks).toEqual({ 1: 598, 3: 590 });
  });
});

describe("pgnGameDetails", () => {
  it("derives opening, link, duration and time control from chess.com headers", () => {
    expect(pgnGameDetails(pgnReviewMetadata(chessCom).headers)).toEqual({
      openingName: "Indian Game East Indian Seirawan Attack",
      openingUrl: "https://www.chess.com/openings/Indian-Game-East-Indian-Seirawan-Attack",
      gameUrl: "https://www.chess.com/analysis/game/live/185525366162/analysis?flip=true",
      sourceSite: "Chess.com",
      durationSeconds: 818,
      baseSeconds: 600,
      incrementSeconds: 0,
    });
  });

  it("ignores non-https links", () => {
    expect(pgnGameDetails({ Site: "javascript:alert(1)" }).gameUrl).toBeUndefined();
  });
});
