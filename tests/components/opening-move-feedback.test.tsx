import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OpeningPractice } from "@/components/openings/practice";
import { EMPTY_OPENING } from "@/lib/openings/content";
const content = { ...EMPTY_OPENING, name: "King pawn", lines: [{ name: "Main", moves: ["e2e4", "e7e5", "g1f3"] }] };
function play(move: string) { fireEvent.change(screen.getByLabelText("Move coordinates"), { target: { value: move } }); fireEvent.click(screen.getByRole("button", { name: "Play move" })); }
function trackAudio() {
  const clips: string[] = [];
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function(this: HTMLMediaElement) { clips.push(new URL(this.src).pathname); return Promise.resolve(); });
  return clips;
}
afterEach(() => { vi.useRealTimers(); vi.mocked(HTMLMediaElement.prototype.play).mockResolvedValue(undefined); });
it("sounds legal moves immediately, waits one second for the opponent, locks input, and respects mute", () => {
  vi.useFakeTimers(); const clips = trackAudio(); render(<OpeningPractice content={content} />);
  fireEvent.click(screen.getByRole("button", { name: "Start practice" })); play("e2e5"); play("d2d4"); expect(clips).toEqual([]);
  play("e2e4"); expect(clips).toEqual(["/sounds/move-self.mp3"]); expect(screen.getByText("Played: e4")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Opponent is thinking…" })).toBeVisible(); expect(screen.getByRole("button", { name: "Play move" })).toBeDisabled(); expect(screen.getByRole("button", { name: "Hint" })).toBeDisabled();
  act(() => vi.advanceTimersByTime(999)); expect(screen.queryByText("Played: e4 · e5")).not.toBeInTheDocument(); expect(clips).toHaveLength(1);
  act(() => vi.advanceTimersByTime(1)); expect(screen.getByText("Played: e4 · e5")).toBeVisible(); expect(clips).toHaveLength(2); expect(screen.getByRole("button", { name: "Play move" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Mute moves" })); play("g1f3"); expect(clips).toHaveLength(2); expect(screen.getByRole("heading", { name: "Variation complete" })).toBeVisible();
});
it("cancels a pending reply when retrying or revealing the solution", () => {
  vi.useFakeTimers(); const clips = trackAudio(); render(<OpeningPractice content={content} />);
  fireEvent.click(screen.getByRole("button", { name: "Start practice" })); play("e2e4");
  fireEvent.click(screen.getByRole("button", { name: "Retry variation" })); act(() => vi.advanceTimersByTime(2000)); expect(screen.getByText("Played: No moves yet")).toBeVisible(); expect(clips).toHaveLength(1);
  play("e2e4"); fireEvent.click(screen.getByRole("button", { name: "Reveal" })); act(() => vi.advanceTimersByTime(2000)); expect(screen.getByText("Played: e4")).toBeVisible(); expect(clips).toHaveLength(2); expect(screen.getByRole("heading", { name: "Solution revealed" })).toBeVisible();
});
it("delays the first opponent move for Black and clears its timer on unmount", () => {
  vi.useFakeTimers(); const clips = trackAudio(); const { unmount } = render(<OpeningPractice content={{ ...content, color: "BLACK" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Start practice" })); expect(screen.getByText("Played: No moves yet")).toBeVisible(); expect(clips).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1000)); expect(screen.getByText("Played: e4")).toBeVisible(); expect(clips).toHaveLength(1);
  play("e7e5"); expect(clips).toHaveLength(2); unmount(); act(() => vi.advanceTimersByTime(2000)); expect(clips).toHaveLength(2);
});
