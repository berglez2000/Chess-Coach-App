import type { PrismaClient } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import { library } from "@/lib/learning/repository";
import { getPlanState } from "@/lib/weekly-plan/repository";
import { getDashboard } from "./queries";

export async function getDashboardOverview(db: PrismaClient, userId: string) {
  const ownerId = requireOwnerId(userId);
  const [games, puzzles, books, materials, plan] = await Promise.all([
    getDashboard(db, ownerId),
    db.personalPuzzle.count({ where: { generation: { status: "COMPLETED", game: { ownerId } } } }),
    db.book.count({ where: { ownerId } }),
    library(db, ownerId),
    getPlanState(db, ownerId),
  ]);
  const progress = materials.map(material => {
    const exercises = material.chapters.flatMap(chapter => chapter.exercises).filter(exercise => exercise.published);
    return { id: material.id, title: material.title, total: exercises.length, completed: exercises.filter(exercise => exercise.published?.progress[0]?.completedAt).length };
  });
  return { ...games, puzzles, books, progress, exerciseTotal: progress.reduce((sum, item) => sum + item.total, 0), exerciseCompleted: progress.reduce((sum, item) => sum + item.completed, 0), plan: plan.accepted };
}
