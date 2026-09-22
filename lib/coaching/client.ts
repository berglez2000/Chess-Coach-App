import "server-only";
import { getDb } from "@/lib/db/client";
import { createCoachingClient } from "@/lib/coaching/ai-client";
import { createCoachingRepository } from "@/lib/coaching/repository";
import { coachGame } from "@/lib/coaching/orchestrate";

export async function coachSavedGame(id: string) {
  return coachGame(id, createCoachingRepository(getDb()), createCoachingClient());
}
