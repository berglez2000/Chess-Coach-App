import { requireOwnerId } from "@/lib/auth/owner";
import "server-only";
import { getDb } from "@/lib/db/client";
import { createCoachingClient } from "@/lib/coaching/ai-client";
import { createCoachingRepository } from "@/lib/coaching/repository";
import { coachGame } from "@/lib/coaching/orchestrate";

import { getCoachingProvider } from "./settings";
import { PROVIDERS } from "./providers";

export async function coachSavedGame(id: string, ownerId: string, expectedRevision?: number) {
  const db = getDb();
  const provider = await getCoachingProvider(db, requireOwnerId(ownerId));
  const options = { provider, model: PROVIDERS[provider].model, expectedRevision };
  return coachGame(id, createCoachingRepository(db, options, ownerId), createCoachingClient(provider), provider);
}
