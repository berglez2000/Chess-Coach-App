import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_PROVIDER, providerSchema, type CoachingProvider, type CoachingSettings } from "./providers";

export async function getCoachingProvider(db: PrismaClient): Promise<CoachingProvider> {
  const settings = await db.appSettings.findUnique({ where: { id: "local" } });
  return settings ? providerSchema.parse(settings.coachingProvider) : DEFAULT_PROVIDER;
}
export async function saveCoachingProvider(db: PrismaClient, input: unknown): Promise<CoachingProvider> {
  const provider = providerSchema.parse(input);
  await db.appSettings.upsert({ where: { id: "local" }, create: { id: "local", coachingProvider: provider }, update: { coachingProvider: provider } });
  return provider;
}
export async function getCoachingSettings(db: PrismaClient): Promise<CoachingSettings> {
  return { provider: await getCoachingProvider(db), available: {
    ANTHROPIC: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    OPENAI: Boolean(process.env.OPENAI_API_KEY?.trim()),
  } };
}
