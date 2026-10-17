import { requireOwnerId } from "@/lib/auth/owner";
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_PROVIDER, coachingSelectionSchema, providerSchema, resolveCoachingModel, type CoachingProvider, type CoachingSelection, type CoachingSettings } from "./providers";

export async function getCoachingProvider(db: PrismaClient, ownerId: string): Promise<CoachingProvider> {
  return (await getCoachingSelection(db, ownerId)).provider;
}
export async function getCoachingSelection(db: PrismaClient, ownerId: string): Promise<CoachingSelection> {
  const settings = await db.userSettings.findUnique({ where: { userId: requireOwnerId(ownerId) } });
  const provider = settings ? providerSchema.parse(settings.coachingProvider) : DEFAULT_PROVIDER;
  return { provider, model: resolveCoachingModel(provider, settings?.coachingModel) };
}
export async function saveCoachingProvider(db: PrismaClient, input: unknown, ownerId: string): Promise<CoachingProvider> {
  return (await saveCoachingSelection(db, { provider: input }, ownerId)).provider;
}
export async function saveCoachingSelection(db: PrismaClient, input: unknown, ownerId: string): Promise<CoachingSelection> {
  const selection = coachingSelectionSchema.parse(input);
  const data = { coachingProvider: selection.provider, coachingModel: selection.model };
  await db.userSettings.upsert({ where: { userId: requireOwnerId(ownerId) }, create: { userId: requireOwnerId(ownerId), ...data }, update: data });
  return selection;
}
export async function getCoachingSettings(db: PrismaClient, ownerId: string): Promise<CoachingSettings> {
  return { ...await getCoachingSelection(db, ownerId), available: {
    ANTHROPIC: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    OPENAI: Boolean(process.env.OPENAI_API_KEY?.trim()),
    DEEPSEEK: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
  } };
}
