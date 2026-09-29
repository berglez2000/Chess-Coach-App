import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { moveSound } from "@/components/chess/use-move-sound";
import { GameReview } from "@/components/games/game-review";
import { parsePgn } from "@/lib/pgn/parse";

it.each([
  ["e4", "move-self.mp3"], ["exd5", "capture.mp3"],
  ["O-O", "castle.mp3"], ["O-O-O", "castle.mp3"],
  ["Qxd5+", "move-check.mp3"], ["e8=Q", "promote.mp3"],
  ["Qh7#", "game-end.webm"],
])("matches %s to its sound", (san, file) => {
  expect(moveSound(san)).toBe(file);
});

it("plays only on navigation and respects mute and replay boundaries", () => {
  const play = vi.mocked(HTMLMediaElement.prototype.play);
  play.mockClear();
  render(<GameReview game={parsePgn("1. e4 e5 1-0")} userColor="WHITE" status="PENDING" />);
  expect(play).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(play).toHaveBeenCalledTimes(1);
  expect((play.mock.instances[0] as HTMLMediaElement).src).toContain("/sounds/move-self.mp3");
  fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(play).toHaveBeenCalledTimes(2);
  expect((play.mock.instances[1] as HTMLMediaElement).src).toContain("/sounds/game-end.webm");
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(play).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Mute sounds" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(play).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Mute sounds" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(play).toHaveBeenCalledTimes(3);
});
