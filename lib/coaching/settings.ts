import { requireOwnerId } from "@/lib/auth/owner";
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_PERSONA, personaSchema } from "./personas";
import { DEFAULT_PROVIDER, PROVIDERS, coachingSelectionSchema, providerSchema, resolveCoachingModel, type CoachingProvider, type CoachingSelection, type CoachingSettings } from "./providers";
import { listPersonalApiKeys } from "./api-keys";

export async function getCoachingProvider(db: PrismaClient, ownerId: string): Promise<CoachingProvider> {
  return (await getCoachingSelection(db, ownerId)).provider;
}
export async function getCoachingSelection(db: PrismaClient, ownerId: string): Promise<CoachingSelection> {
  const settings = await db.userSettings.findUnique({ where: { userId: requireOwnerId(ownerId) } });
  const provider = settings ? providerSchema.parse(settings.coachingProvider) : DEFAULT_PROVIDER;
  const persona = personaSchema.safeParse(settings?.coachingPersona);
  return { provider, model: resolveCoachingModel(provider, settings?.coachingModel), persona: persona.success ? persona.data : DEFAULT_PERSONA };
}
export async function saveCoachingProvider(db: PrismaClient, input: unknown, ownerId: string): Promise<CoachingProvider> {
  return (await saveCoachingSelection(db, { provider: input }, ownerId)).provider;
}
export async function saveCoachingSelection(db: PrismaClient, input: unknown, ownerId: string): Promise<CoachingSelection> {
  const selection = coachingSelectionSchema.parse(input);
  // Persona is optional so provider-only saves keep the stored voice.
  const data = { coachingProvider: selection.provider, coachingModel: selection.model, ...(selection.persona ? { coachingPersona: selection.persona } : {}) };
  await db.userSettings.upsert({ where: { userId: requireOwnerId(ownerId) }, create: { userId: requireOwnerId(ownerId), ...data }, update: data });
  return getCoachingSelection(db, ownerId);
}
export async function getCoachingSettings(db: PrismaClient, ownerId: string): Promise<CoachingSettings> {
  const [selection, personalKeys] = await Promise.all([getCoachingSelection(db, ownerId), listPersonalApiKeys(db, ownerId)]);
  // A user's own key overrides the server's; the server key is the shared fallback.
  const available = (provider: CoachingProvider) => Boolean(personalKeys?.[provider]?.readable || process.env[PROVIDERS[provider].key]?.trim());
  return { ...selection, available: { ANTHROPIC: available("ANTHROPIC"), OPENAI: available("OPENAI"), DEEPSEEK: available("DEEPSEEK") }, personalKeys };
}
