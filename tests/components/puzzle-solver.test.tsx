import { Chess } from "chess.js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PuzzleSolver } from "@/components/puzzles/puzzle-solver";
import { INITIAL_PROGRESS, solverDto, applyPuzzleAction, type PuzzleDefinition } from "@/lib/puzzles/solve";
import type { PuzzleAction } from "@/types/puzzle";

const definition: PuzzleDefinition = { id: "puzzle", startingFen: new Chess().fen(), playerColor: "WHITE", sourcePly: 5, acceptedMoves: ["e2e4"], generation: { gameId: "game" } };
const initial = solverDto(definition, INITIAL_PROGRESS);
afterEach(() => vi.unstubAllGlobals());
function mockedServer(puzzleDefinition = definition) {
  let state = { ...INITIAL_PROGRESS };
  const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
    const action = JSON.parse(options.body as string) as PuzzleAction;
    state = applyPuzzleAction(puzzleDefinition, state, action);
    return Response.json({ puzzle: solverDto(puzzleDefinition, state) });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function enter(move: string) {
  fireEvent.change(screen.getByLabelText("Move coordinates"), { target: { value: move } });
  fireEvent.click(screen.getByRole("button", { name: "Check move" }));
}
it.each([
  [new Chess().fen(), "e2e4", "move-self.mp3"],
  ["7k/8/8/8/8/8/p7/R6K w - - 0 1", "a1a2", "capture.mp3"],
  ["7k/8/5KQ1/8/8/8/8/8 w - - 0 1", "g6g7", "game-end.webm"],
])("plays the Learning move sound during the input gesture for %s %s", async (startingFen, move, sound) => {
  const puzzleDefinition = { ...definition, startingFen, acceptedMoves: [move] };
  mockedServer(puzzleDefinition);
  const play = vi.mocked(HTMLMediaElement.prototype.play);
  play.mockClear();
  render(<PuzzleSolver initialPuzzle={{ ...solverDto(puzzleDefinition, INITIAL_PROGRESS), learning: {
    revisionId: "revision", objective: "Practice", prompt: "Find the move", hint: null, publishedSolution: null, explanation: null,
  } }} nextId={null} />);
  expect(play).not.toHaveBeenCalled();
  enter(move);
  expect(play).toHaveBeenCalledOnce();
  await waitFor(() => expect(play).toHaveBeenCalledOnce());
  expect((play.mock.instances[0] as HTMLMediaElement).src).toContain(`/sounds/${sound}`);
});
it("sounds legal attempts, keeps illegal moves and hints silent, and respects mute", async () => {
  mockedServer();
  const play = vi.mocked(HTMLMediaElement.prototype.play);
  play.mockClear();
  render(<PuzzleSolver initialPuzzle={initial} nextId={null} />);
  enter("e2e5");
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("Illegal move"));
  expect(play).not.toHaveBeenCalled();
  enter("g1f3");
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("not a solution"));
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  await screen.findByText(/Hint: move/);
  expect(play).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Mute sounds" }));
  expect(screen.getByRole("button", { name: "Mute sounds" })).toHaveAttribute("aria-pressed", "true");
  enter("e2e4");
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("Correct!"));
  expect(play).toHaveBeenCalledOnce();
});
it("starts audio before a delayed save and sounds the confirmed automatic reply", async () => {
  const play = vi.mocked(HTMLMediaElement.prototype.play);
  play.mockClear();
  const exercise = { ...definition, solution: { version: 1, maxPlayerMoves: 3, lines: [
    { moves: ["e2e4", "d7d5", "e4d5"], goal: "validated-boundary" },
  ] } };
  const saved = solverDto(exercise, applyPuzzleAction(exercise, INITIAL_PROGRESS,
    { action: "MOVE", move: "e2e4", requestId: "first", expectedRevision: 0 }));
  let resolve!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => {
    expect(play).toHaveBeenCalledOnce();
    return new Promise<Response>(done => { resolve = done; });
  }));
  render(<PuzzleSolver initialPuzzle={solverDto(exercise, INITIAL_PROGRESS)} nextId={null} />);
  enter("e2e4");
  expect(play).toHaveBeenCalledOnce();
  resolve(Response.json({ puzzle: saved }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
});
it("hides the answer, sends a move to the server and displays the saved solution", async () => {
  const request = mockedServer();
  render(<PuzzleSolver initialPuzzle={initial} nextId="next" />);
  expect(screen.queryByText(/Solution:/)).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Puzzle position, White at the bottom" })).toBeInTheDocument();
  enter("e2e4");
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("Correct! Puzzle solved."));
  expect(screen.getByText(/First completion saved/)).toHaveTextContent("Unassisted");
  const body = JSON.parse(request.mock.calls[0][1].body as string);
  expect(body).toMatchObject({ expectedRevision: 0, action: "MOVE", move: "e2e4" });
  expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(screen.getByRole("link", { name: "Next puzzle →" })).toHaveAttribute("href", "/puzzles/next");
  expect(screen.getByRole("link", { name: "Return to source review" })).toHaveAttribute("href", "/games/game?ply=5");
});
it("distinguishes illegal and incorrect moves while keeping the position playable", async () => {
  mockedServer(); render(<PuzzleSolver initialPuzzle={initial} nextId={null} />);
  enter("e2e5"); await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("Illegal move"));
  enter("g1f3"); await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("legal, but it is not a solution"));
  expect(screen.queryByText(/Solution:/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check move" })).toBeEnabled();
});
it("keeps assisted completion after a hint and retry", async () => {
  mockedServer(); render(<PuzzleSolver initialPuzzle={initial} nextId={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  await waitFor(() => expect(screen.getByText(/Hint: move/)).toHaveTextContent("e2"));
  fireEvent.click(screen.getByRole("button", { name: "Retry puzzle" }));
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("Starting position restored"));
  enter("e2e4"); await waitFor(() => expect(screen.getByText(/First completion saved/)).toHaveTextContent("Assisted"));
});
it("retries an uncertain request with the same id, instead of sending a second attempt", async () => {
  const solved = solverDto(definition, applyPuzzleAction(definition, INITIAL_PROGRESS, { action: "MOVE", move: "e2e4", requestId: "test", expectedRevision: 0 }));
  const request = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ puzzle: solved }));
  vi.stubGlobal("fetch", request);
  render(<PuzzleSolver initialPuzzle={initial} nextId={null} />);
  enter("e2e4");
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
  expect(screen.getByRole("button", { name: "Check move" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry saving action" }));
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("Correct!"));
  expect(request.mock.calls[1][1].body).toBe(request.mock.calls[0][1].body);
});
it("loads updated progress on a stale-tab conflict", async () => {
  const hinted = solverDto(definition, applyPuzzleAction(definition, INITIAL_PROGRESS, { action: "HINT", requestId: "test", expectedRevision: 0 }));
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ puzzle: hinted, error: { message: "Progress changed in another request." } }, { status: 409 })));
  render(<PuzzleSolver initialPuzzle={initial} nextId={null} />);
  enter("e2e4");
  expect(await screen.findByRole("alert")).toHaveTextContent("Progress changed");
  expect(screen.getByText(/Hint: move/)).toHaveTextContent("e2");
  expect(screen.getByRole("button", { name: "Check move" })).toBeEnabled();
});
it("orients Black puzzles and submits underpromotion chosen after moving", async () => {
  const board = new Chess(); board.move("e4");
  const black = solverDto({ ...definition, playerColor: "BLACK", startingFen: board.fen() }, INITIAL_PROGRESS);
  const { unmount } = render(<PuzzleSolver initialPuzzle={black} nextId={null} />);
  expect(screen.getByRole("group", { name: "Puzzle position, Black at the bottom" })).toBeInTheDocument();
  unmount();
  const promotion = solverDto({ ...definition, startingFen: "7k/P7/8/8/8/8/8/7K w - - 0 1", acceptedMoves: ["a7a8n"] }, INITIAL_PROGRESS);
  const request = vi.fn(async () => Response.json({ puzzle: promotion })); vi.stubGlobal("fetch", request);
  render(<PuzzleSolver initialPuzzle={promotion} nextId={null} />);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  enter("a7a8");
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Promote your pawn" })).toBeInTheDocument();
  for (const piece of ["queen", "rook", "knight", "bishop"]) expect(screen.getByRole("button", { name: `Promote to ${piece}` })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Promote to knight" }));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  expect(JSON.parse((request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toHaveProperty("move", "a7a8n");
});
const sequence = { ...definition, solution: { version: 1, maxPlayerMoves: 3, lines: [
  { moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"], goal: "validated-boundary" },
] } };
it("plays a sequence on the real board, shows replies, reloads midway, and reveals the complete line", async () => {
  mockedServer(sequence);
  const { unmount } = render(<PuzzleSolver initialPuzzle={solverDto(sequence, INITIAL_PROGRESS)} nextId={null} />);
  const board = screen.getByRole("group", { name: "Puzzle position, White at the bottom" });
  fireEvent.click(board.querySelector('[data-square="e2"]')!);
  fireEvent.click(board.querySelector('[data-square="e4"]')!);
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("opponent replied automatically"));
  expect(screen.getByLabelText("Played sequence")).toHaveTextContent("e4 → e5");
  expect(screen.queryByText(/First completion saved/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Solution:/)).not.toBeInTheDocument();
  fireEvent.click(board.querySelector('[data-square="g1"]')!);
  fireEvent.click(board.querySelector('[data-square="f3"]')!);
  await waitFor(() => expect(screen.getByLabelText("Played sequence")).toHaveTextContent("Nf3 → Nc6"));
  const midway = applyPuzzleAction(sequence, applyPuzzleAction(sequence, INITIAL_PROGRESS,
    { action: "MOVE", move: "e2e4", requestId: "first", expectedRevision: 0 }),
    { action: "MOVE", move: "g1f3", requestId: "second", expectedRevision: 1 });
  unmount();
  render(<PuzzleSolver initialPuzzle={solverDto(sequence, midway)} nextId={null} />);
  expect(screen.getByLabelText("Played sequence")).toHaveTextContent("e4 → e5 → Nf3 → Nc6");
  enter("f1b5");
  await waitFor(() => expect(screen.getByText(/First completion saved/)).toHaveTextContent("Unassisted"));
  expect(screen.getByText(/^Solution:/)).toHaveTextContent("e4 → e5 → Nf3 → Nc6 → Bb5");
  expect(screen.getByText(/Validated sequence complete/)).toBeInTheDocument();
});
it("locks input while a move/reply is delayed and restarts the saved sequence cleanly", async () => {
  let resolve!: (response: Response) => void;
  const saved = applyPuzzleAction(sequence, INITIAL_PROGRESS, { action: "MOVE", move: "e2e4", requestId: "first", expectedRevision: 0 });
  const request = vi.fn().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }))
    .mockResolvedValueOnce(Response.json({ puzzle: solverDto(sequence, applyPuzzleAction(sequence, saved, { action: "RETRY", requestId: "retry", expectedRevision: 1 })) }));
  vi.stubGlobal("fetch", request);
  render(<PuzzleSolver initialPuzzle={solverDto(sequence, INITIAL_PROGRESS)} nextId={null} />);
  enter("e2e4");
  expect(screen.getByRole("button", { name: "Retry puzzle" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Check move" })).toBeDisabled();
  resolve(Response.json({ puzzle: solverDto(sequence, saved) }));
  await waitFor(() => expect(screen.getByLabelText("Played sequence")).toHaveTextContent("e4 → e5"));
  fireEvent.click(screen.getByRole("button", { name: "Retry puzzle" }));
  await waitFor(() => expect(screen.queryByLabelText("Played sequence")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Check move" })).toBeEnabled();
  expect(request).toHaveBeenCalledTimes(2);
});

it.each(["q", "r", "n", "b"])("offers %s promotion after moving a Black pawn on the board", async code => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  const puzzle = solverDto({ ...definition, playerColor: "BLACK", startingFen: "7k/8/8/8/8/8/p7/7K b - - 0 1", acceptedMoves: [`a2a1${code}`] }, INITIAL_PROGRESS);
  const request = vi.fn(async () => Response.json({ puzzle })); vi.stubGlobal("fetch", request);
  render(<PuzzleSolver initialPuzzle={puzzle} nextId={null} />);
  const board = screen.getByRole("group", { name: "Puzzle position, Black at the bottom" });
  fireEvent.click(board.querySelector('[data-square="a2"]')!);
  fireEvent.click(board.querySelector('[data-square="a1"]')!);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel move" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(board.querySelector('[data-square="a2"]')!);
  fireEvent.click(board.querySelector('[data-square="a1"]')!);
  const name = { q: "queen", r: "rook", n: "knight", b: "bishop" }[code];
  fireEvent.click(screen.getByRole("button", { name: `Promote to ${name}` }));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  expect(JSON.parse((request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toHaveProperty("move", `a2a1${code}`);
});

it("places the missing piece by board click and keyboard without moving an existing piece", async () => {
  const { contentSchema, validateContent } = await import("@/lib/learning/content");
  const { applyPlacementAction, placementDto } = await import("@/lib/learning/placement");
  const content = contentSchema.parse({ type: "MISSING_PIECE", placementPiece: "n", fen: "6rk/6pp/8/1p1b4/p7/3P4/PPP5/1K5R w - - 0 1", solutionText: "Ng6#" });
  const accepted = validateContent(content).acceptedMoves;
  let state = { ...INITIAL_PROGRESS };
  const dto = () => ({ ...placementDto("placement", content, accepted, state), learning: { revisionId: "revision", type: "MISSING_PIECE" as const, placementPiece: content.placementPiece, objective: "Place a knight to give checkmate", prompt: "Add a knight", hint: null, publishedSolution: state.state === "SOLVING" ? null : content.solutionText, explanation: null } });
  const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
    state = applyPlacementAction(content, accepted, state, JSON.parse(options.body as string));
    return Response.json({ puzzle: dto() });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<PuzzleSolver initialPuzzle={dto()} nextId={null} />);
  expect(screen.queryByLabelText("Move coordinates")).not.toBeInTheDocument();
  expect(screen.queryByText(/Ng6/)).not.toBeInTheDocument();
  const board = screen.getByRole("group", { name: "Puzzle position, White at the bottom" });
  fireEvent.click(board.querySelector('[data-square="h8"]')!);
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("empty square"));
  fireEvent.change(screen.getByLabelText("Placement square"), { target: { value: "e4" } });
  fireEvent.click(screen.getByRole("button", { name: "Check placement" }));
  await waitFor(() => expect(screen.getByRole("status", { name: "Puzzle feedback" })).toHaveTextContent("does not give checkmate"));
  fireEvent.click(board.querySelector('[data-square="g6"]')!);
  await waitFor(() => expect(screen.getByText(/First completion saved/)).toHaveTextContent("Unassisted"));
  expect(screen.getByText(/^Solution:/)).toHaveTextContent("Ng6#");
  expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body as string).move)).toEqual(["n@h8", "n@e4", "n@g6"]);
});
