import "server-only";
import { getDb } from "@/lib/db/client";
import { createCoachingClient } from "@/lib/coaching/ai-client";
import { createCoachingRepository } from "@/lib/coaching/repository";
import { coachGame } from "@/lib/coaching/orchestrate";

import { getCoachingProvider } from "./settings";
import { PROVIDERS } from "./providers";

export async function coachSavedGame(id: string, expectedRevision?: number) {
  const db = getDb();
  const provider = await getCoachingProvider(db);
  const options = { provider, model: PROVIDERS[provider].model, expectedRevision };
  return coachGame(id, createCoachingRepository(db, options), createCoachingClient(provider), provider);
}
