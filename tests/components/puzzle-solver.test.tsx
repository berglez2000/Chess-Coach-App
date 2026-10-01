import { Chess } from "chess.js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PuzzleSolver } from "@/components/puzzles/puzzle-solver";
import { INITIAL_PROGRESS, solverDto, applyPuzzleAction, type PuzzleDefinition } from "@/lib/puzzles/solve";
import type { PuzzleAction } from "@/types/puzzle";

const definition: PuzzleDefinition = { id: "puzzle", startingFen: new Chess().fen(), playerColor: "WHITE", sourcePly: 5, acceptedMoves: ["e2e4"], generation: { gameId: "game" } };
const initial = solverDto(definition, INITIAL_PROGRESS);
afterEach(() => vi.unstubAllGlobals());
function mockedServer() {
  let state = { ...INITIAL_PROGRESS };
  const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
    const action = JSON.parse(options.body as string) as PuzzleAction;
    state = applyPuzzleAction(definition, state, action);
    return Response.json({ puzzle: solverDto(definition, state) });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function enter(move: string) {
  fireEvent.change(screen.getByLabelText("Move coordinates"), { target: { value: move } });
  fireEvent.click(screen.getByRole("button", { name: "Check move" }));
}
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
it("orients Black puzzles and submits underpromotion selected before moving", async () => {
  const board = new Chess(); board.move("e4");
  const black = solverDto({ ...definition, playerColor: "BLACK", startingFen: board.fen() }, INITIAL_PROGRESS);
  const { unmount } = render(<PuzzleSolver initialPuzzle={black} nextId={null} />);
  expect(screen.getByRole("group", { name: "Puzzle position, Black at the bottom" })).toBeInTheDocument();
  unmount();
  const promotion = solverDto({ ...definition, startingFen: "7k/P7/8/8/8/8/8/7K w - - 0 1", acceptedMoves: ["a7a8n"] }, INITIAL_PROGRESS);
  const request = vi.fn(async () => Response.json({ puzzle: promotion })); vi.stubGlobal("fetch", request);
  render(<PuzzleSolver initialPuzzle={promotion} nextId={null} />);
  fireEvent.change(screen.getByLabelText("Promotion piece"), { target: { value: "n" } });
  enter("a7a8");
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  expect(JSON.parse((request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toHaveProperty("move", "a7a8n");
});
