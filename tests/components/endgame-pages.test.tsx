import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn(async () => ({ id: "test-user" })) }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import ChapterPage from "@/app/endgames/[chapterId]/page";
import PracticePage from "@/app/endgames/[chapterId]/[positionId]/page";

it("rejects unknown chapters and positions belonging to another chapter", async () => {
  await expect(ChapterPage({ params: Promise.resolve({ chapterId: "missing" }) })).rejects.toThrow("NOT_FOUND");
  await expect(PracticePage({ params: Promise.resolve({ chapterId: "basic-checkmates", positionId: "pawn-white" }) })).rejects.toThrow("NOT_FOUND");
  expect(requireUser).toHaveBeenCalled();
});

it("opens a position directly with chapter and adjacent-position links", async () => {
  render(await PracticePage({ params: Promise.resolve({ chapterId: "king-and-pawn", positionId: "pawn-black" }) }));
  expect(screen.getByLabelText("Starting FEN")).toHaveValue("8/8/8/8/8/4k3/4p1K1/8 b - - 0 1");
  expect(screen.getByRole("link", { name: "Back to chapter" })).toHaveAttribute("href", "/endgames/king-and-pawn");
  expect(screen.getByRole("link", { name: "Previous position" })).toHaveAttribute("href", "/endgames/king-and-pawn/pawn-white");
  expect(screen.getByRole("link", { name: "Next position" })).toHaveAttribute("href", "/endgames/king-and-pawn/rook-pawn-draw");
});
