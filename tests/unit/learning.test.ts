import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { contentSchema, SAMPLE_CONTENT, validateContent, answerIdentity } from "@/lib/learning/content";
import { readSolution } from "@/lib/puzzles/sequence";
import { applyPuzzleAction, INITIAL_PROGRESS, solverDto } from "@/lib/puzzles/solve";
import { randomUUID } from "node:crypto";
describe("learning validation", () => {
  it("validates the supplied book position and accepts all immediate mates", () => {
    const result = validateContent(SAMPLE_CONTENT);
    const board = new Chess(SAMPLE_CONTENT.fen);
    const mates = board.moves({ verbose:true }).filter(move => { board.move(move); const mate=board.isCheckmate(); board.undo(); return mate; }).map(move => move.lan);
    expect(result.method).toBe("exhaustive-forced-mate-v1");
    expect(result.acceptedMoves.sort()).toEqual(mates.sort());
    expect(result.acceptedMoves).toContain("a1a6");
    expect(result.solution.lines.every(line => line.goal === "mate")).toBe(true);
  });
  it("accepts multiple immediate mates and verifies a three-move mate", () => {
    const multiple=validateContent({...SAMPLE_CONTENT,fen:"7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",solutionText:"Qg7#"});
    expect(multiple.acceptedMoves.length).toBeGreaterThan(1);
    const three=validateContent({...SAMPLE_CONTENT,fen:"3r1rk1/ppp2Npp/8/8/8/1Q6/8/6K1 w - - 6 4",mateIn:3,solutionText:"Nh6+ Kh8 Qg8+ Rxg8 Nf7#"});
    expect(three.solution.lines).toContainEqual({moves:["f7h6","g8h8","b3g8","f8g8","h6f7"],goal:"mate"});
  });
  it("proves the smothered mate against every defense and preserves the published reply", () => {
    const result = validateContent({ ...SAMPLE_CONTENT, fen: "3r1r1k/ppp3pp/7N/8/8/1Q6/8/6K1 w - - 4 3", mateIn:2, solutionText:"Qg8+ Rxg8 Nf7#" });
    expect(result.solution.lines).toContainEqual({ moves:["b3g8","f8g8","h6f7"], goal:"mate" });
  });
  it("does not confuse a cooperative mating line with forced mate", () => {
    expect(() => validateContent({ ...SAMPLE_CONTENT, fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR w KQkq - 0 2", mateIn:2, solutionText:"Bc4 Nc6 Qxf7#" })).toThrow(/does not force|search limit/);
  });
  it("bounds expensive searches and rejects incomplete/invalid authoring", () => {
    expect(() => validateContent(SAMPLE_CONTENT,{nodes:0,milliseconds:5000})).toThrow("search limit");
    expect(() => validateContent({ ...SAMPLE_CONTENT, solver:"BLACK" })).toThrow("Side to move");
    expect(() => validateContent({ ...SAMPLE_CONTENT, fen:"8/8/8/8/8/8/8/8 w - - 0 1" })).toThrow("valid full FEN");
    expect(() => validateContent({ ...SAMPLE_CONTENT, solutionText:"Ra8#" })).toThrow("Invalid solution");
    expect(() => validateContent({ ...SAMPLE_CONTENT, type:"MISSING_PIECE" })).toThrow("rules");
    expect(() => validateContent({ ...SAMPLE_CONTENT, solutionText:"Ra2" })).toThrow("reach checkmate");
  });
  it("checks multiple sequence branches independently and rejects conflicting replies", () => {
    const base=contentSchema.parse({fen:new Chess().fen(),objective:"SEQUENCE",solutionText:"e4 e5 Nf3\nd4 d5 c4"});
    expect(validateContent(base).acceptedMoves).toEqual(["e2e4","d2d4"]);
    expect(() => validateContent({...base, solutionText:"e4 e5 Nf3\ne4 c5 Nf3"})).toThrow("Conflicting");
  });
  it("supports four solver moves without changing legacy sequence limits and conceals answers", () => {
    const fourBound=validateContent({...SAMPLE_CONTENT,fen:"k7/2P5/1K6/8/8/8/8/8 w - - 0 1",mateIn:4,solutionText:"c8=Q#"});
    expect(fourBound.acceptedMoves).toContain("c7c8q");
    expect(fourBound.solution.maxPlayerMoves).toBe(4);
    const content=contentSchema.parse({ fen:new Chess().fen(), objective:"SEQUENCE", solutionText:"e4 e5 Nf3 Nc6 Bb5 a6 Ba4" });
    const validation=validateContent(content);
    expect(() => readSolution({...validation.solution,version:1,maxPlayerMoves:3},content.fen,validation.acceptedMoves,content.solver)).toThrow();
    const definition={id:"exercise",startingFen:content.fen,playerColor:content.solver,sourcePly:0,generation:{gameId:""},acceptedMoves:validation.acceptedMoves,solution:validation.solution};
    expect(solverDto(definition,INITIAL_PROGRESS)).toMatchObject({maxPlayerMoves:4,solutionLine:null});
    let state={...INITIAL_PROGRESS};
    for (const move of ["e2e4","g1f3","f1b5","b5a4"]) state=applyPuzzleAction(definition,state,{action:"MOVE",move,requestId:randomUUID(),expectedRevision:state.revision});
    expect(state.state).toBe("SOLVED"); expect(state.playedMoves).toHaveLength(7);
    expect(solverDto(definition,state).solutionLine).toHaveLength(7);
  });
  it("preserves answer identity for provenance edits and detects answer/help changes", () => {
    expect(answerIdentity({...SAMPLE_CONTENT,diagramPage:"7"})).toBe(answerIdentity(SAMPLE_CONTENT));
    expect(answerIdentity({...SAMPLE_CONTENT,solutionText:"Rxa6"})).not.toBe(answerIdentity(SAMPLE_CONTENT));
    expect(answerIdentity({...SAMPLE_CONTENT,hint:"Use the rook"})).not.toBe(answerIdentity(SAMPLE_CONTENT));
  });
});
