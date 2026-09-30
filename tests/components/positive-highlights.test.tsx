import { fireEvent, render, screen, within } from "@testing-library/react";
import { Chess } from "chess.js";
import { expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { MoveAssessment } from "@/types/analysis";
import { findGame } from "@/lib/games/queries";
import { parsePgn } from "@/lib/pgn/parse";
import { GameReview } from "@/components/games/game-review";

async function fixture(options: { userColor?: "WHITE" | "BLACK"; evidence?: "mate" | "quiet" | "invalid"; annotation?: boolean } = {}) {
  const game = parsePgn("1. f3 e5 2. g4 Qh4# 0-1");
  const move = game.moves[3];
  const assessment: MoveAssessment = {
    policyVersion: 1, quality: "normal", reason: options.evidence === "quiet" ? "cp_loss" : "checkmate",
    cpLoss: null, rawCpLoss: null,
    facts: {
      fenBefore: move.fenBefore, fenAfter: move.fenAfter, move: move.uci, mover: move.color,
      legalMoveCount: new Chess(move.fenBefore).moves().length, bestMove: move.uci,
      terminal: "checkmate", before: null,
      after: { perspective: "WHITE", depth: 0, pv: [], score: { kind: "mate", value: 0, winner: "BLACK", bound: "exact" } },
    },
  };
  const stored = {
    ...game.metadata, id: "fixture", initialFen: game.initialFen, userColor: options.userColor ?? "BLACK",
    playedAt: null, createdAt: new Date(), analysisStatus: "COMPLETED", analysisError: null, analysisLeaseUntil: null,
    coachingSummary: "Review the final mating pattern.", coachingStrengths: [], coachingImprovements: [], coachingModel: "fixture",
    moves: game.moves.map(m => ({ ...m,
      engineAnalysis: m.ply === 4 ? { assessment: options.evidence === "invalid" ? { policyVersion: 1 } : assessment,
        bestMoveSan: "Qh4#", pvSan: [], runId: "fixture", analyzedAt: new Date() } : null,
      coachingAnnotation: m.ply === 4 && options.annotation !== false ? {
        classification: "normal", headline: "Finish the mating attack", explanation: "The queen delivers checkmate along the diagonal.",
        lesson: "Look for checks against an exposed king.", category: "calculation.candidate_moves", model: "fixture",
      } : null,
    })),
  };
  const db = { game: { findUnique: vi.fn().mockResolvedValue(stored) } } as unknown as PrismaClient;
  const saved = await findGame(db, "fixture", "test-user");
  render(<GameReview game={saved!.game} userColor={saved!.userColor} status={saved!.status} />);
  fireEvent.click(screen.getByText("Read full review"));
  fireEvent.click(screen.getByText("Engine details"));
  return saved!;
}

it("restores a supported positive highlight and navigates to its coaching without replacing engine quality", async () => {
  const saved = await fixture();
  expect(saved.game.moves[3].positiveHighlight).toBe(true);
  const highlights = screen.getByRole("navigation", { name: "Positive highlights" });
  expect(highlights).toHaveTextContent("The queen delivers checkmate along the diagonal.");
  expect(highlights).toHaveTextContent("Look for checks against an exposed king.");
  fireEvent.click(within(highlights).getByRole("button", { name: "2… Qh4# · Positive highlight" }));
  expect(screen.getByText("Move 2... Qh4# · Half-move 4 of 4")).toBeVisible();
  const engine = screen.getByRole("region", { name: "Engine analysis" });
  expect(within(engine).getByText("normal", { exact: true })).toBeVisible();
  expect(engine).toHaveTextContent("Black has delivered checkmate");
  const coaching = screen.getByRole("region", { name: "Coaching" });
  expect(coaching).toHaveTextContent("Finish the mating attack");
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  fireEvent.click(within(screen.getByRole("table", { name: "Game moves" })).getByRole("button", { name: "2. Black Qh4# — normal — Positive highlight" }));
  expect(screen.getByText("Move 2... Qh4# · Half-move 4 of 4")).toBeVisible();
});

it.each([
  { evidence: "quiet" as const },
  { evidence: "invalid" as const },
  { userColor: "WHITE" as const },
])("does not invent highlights from ordinary annotations, invalid evidence, or opponent successes (%j)", async options => {
  await fixture(options);
  expect(screen.queryByRole("navigation", { name: "Positive highlights" })).not.toBeInTheDocument();
  expect(screen.queryByText("No supported positive highlights were selected for this game.")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Positive highlight/ })).not.toBeInTheDocument();
});

it("shows supported evidence without fabricating missing coaching", async () => {
  await fixture({ annotation: false });
  expect(screen.getByRole("navigation", { name: "Positive highlights" })).toHaveTextContent("Coaching for this highlight is unavailable.");
  expect(screen.queryByText("Finish the mating attack")).not.toBeInTheDocument();
});
