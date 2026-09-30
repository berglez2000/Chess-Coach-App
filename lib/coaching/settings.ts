import { requireOwnerId } from "@/lib/auth/owner";
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_PROVIDER, providerSchema, type CoachingProvider, type CoachingSettings } from "./providers";

export async function getCoachingProvider(db: PrismaClient, ownerId: string): Promise<CoachingProvider> {
  const settings = await db.userSettings.findUnique({ where: { userId: requireOwnerId(ownerId) } });
  return settings ? providerSchema.parse(settings.coachingProvider) : DEFAULT_PROVIDER;
}
export async function saveCoachingProvider(db: PrismaClient, input: unknown, ownerId: string): Promise<CoachingProvider> {
  const provider = providerSchema.parse(input);
  await db.userSettings.upsert({ where: { userId: requireOwnerId(ownerId) }, create: { userId: requireOwnerId(ownerId), coachingProvider: provider }, update: { coachingProvider: provider } });
  return provider;
}
export async function getCoachingSettings(db: PrismaClient, ownerId: string): Promise<CoachingSettings> {
  return { provider: await getCoachingProvider(db, ownerId), available: {
    ANTHROPIC: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    OPENAI: Boolean(process.env.OPENAI_API_KEY?.trim()),
  } };
}
