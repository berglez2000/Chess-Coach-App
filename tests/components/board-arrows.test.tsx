import { fireEvent, render, screen } from "@testing-library/react";
import { Chess } from "chess.js";
import { expect, it, vi } from "vitest";
import { ReplayBoard } from "@/components/chess/replay-board";

function square(name: string) { return document.querySelector(`[data-square="${name}"]`)!; }
function draw(from: string, to: string, shiftKey = false) {
  fireEvent.mouseDown(square(from), { button: 2, buttons: 2, shiftKey });
  fireEvent.mouseOver(square(to), { button: 2, buttons: 2, shiftKey });
  fireEvent.mouseUp(square(to), { button: 2, shiftKey });
}
function arrows() { return document.querySelectorAll("path[marker-end]"); }

it.each(["WHITE", "BLACK"] as const)("draws, toggles and clears colored arrows with %s at the bottom", userColor => {
  render(<ReplayBoard fen={new Chess().fen()} userColor={userColor} />);
  draw("e2", "e4");
  expect(arrows()).toHaveLength(1);
  expect(arrows()[0]).toHaveAttribute("stroke", "#ffaa00");
  draw("d2", "d4", true);
  expect(arrows()).toHaveLength(2);
  expect(arrows()[1]).toHaveAttribute("stroke", "#38bdf8");
  draw("e2", "e4");
  expect(arrows()).toHaveLength(1);
  fireEvent.mouseDown(square("a3"), { button: 0 });
  expect(arrows()).toHaveLength(0);
  expect(fireEvent.contextMenu(square("a3"))).toBe(false);
});

it("draws bent knight arrows, follows board orientation and clears on position changes", () => {
  const chess = new Chess();
  const { rerender } = render(<ReplayBoard fen={chess.fen()} userColor="WHITE" />);
  draw("g1", "f3");
  const path = arrows()[0].getAttribute("d")!;
  expect(path.match(/L/g)).toHaveLength(2);
  rerender(<ReplayBoard fen={chess.fen()} userColor="WHITE" flipped />);
  expect(arrows()).toHaveLength(1);
  expect(arrows()[0].getAttribute("d")).not.toBe(path);
  chess.move("e4");
  rerender(<ReplayBoard fen={chess.fen()} userColor="WHITE" flipped />);
  expect(arrows()).toHaveLength(0);
});

it("drawing exploration arrows does not play or select a move", () => {
  const onMove = vi.fn();
  const onSquareClick = vi.fn();
  render(<ReplayBoard fen={new Chess().fen()} userColor="BLACK" onMove={onMove} onSquareClick={onSquareClick} />);
  draw("e2", "e4");
  expect(arrows()).toHaveLength(1);
  expect(onMove).not.toHaveBeenCalled();
  expect(onSquareClick).not.toHaveBeenCalled();
  expect(screen.getByRole("group", { name: /Exploration position/ }).querySelector('[data-square="e2"] [data-piece]')).toHaveAttribute("data-piece", "wP");
});
