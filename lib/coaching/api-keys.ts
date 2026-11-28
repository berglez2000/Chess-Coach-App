import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireOwnerId } from "@/lib/auth/owner";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CoachingProvider, PersonalKeys } from "./providers";

/** Provider keys are long printable tokens; reject pasted whitespace, quotes around nothing, and short placeholders. */
export const apiKeyInputSchema = z.object({ apiKey: z.string().trim().min(20).max(512).regex(/^[\x21-\x7e]+$/) }).strict();

/** Null when API_KEY_ENCRYPTION_SECRET is missing or too short: personal keys are then off and only server keys apply. */
function encryptionKey(): Buffer | null {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  return Buffer.from(hkdfSync("sha256", secret, "", "chess-coach:user-api-keys:v1", 32));
}
export function personalKeysEnabled(): boolean { return encryptionKey() !== null; }

// The owner and provider are authenticated with the ciphertext, so a row copied to another user or provider fails to open.
const binding = (userId: string, provider: CoachingProvider) => Buffer.from(`${userId}:${provider}`);
function seal(key: Buffer, plaintext: string, aad: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv).setAAD(aad);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", ...[iv, cipher.getAuthTag(), body].map(part => part.toString("base64url"))].join(".");
}
function open(key: Buffer, sealed: string, aad: Buffer): string | null {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"), { authTagLength: 16 })
      .setAAD(aad).setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch { return null; }
}

/** The user's own key, or null when they have none or it cannot be read; callers then fall back to the server key. */
export async function getPersonalApiKey(db: PrismaClient, ownerId: string, provider: CoachingProvider): Promise<string | null> {
  const key = encryptionKey();
  if (!key) return null;
  const userId = requireOwnerId(ownerId);
  const row = await db.userApiKey.findUnique({ where: { userId_provider: { userId, provider } } });
  return row ? open(key, row.ciphertext, binding(userId, provider)) : null;
}
/** Display status only, never key material. Null when personal keys are off. */
export async function listPersonalApiKeys(db: PrismaClient, ownerId: string): Promise<PersonalKeys | null> {
  const key = encryptionKey();
  if (!key) return null;
  const userId = requireOwnerId(ownerId);
  const rows = await db.userApiKey.findMany({ where: { userId } });
  return Object.fromEntries(rows.map(row => [row.provider, { lastFour: row.lastFour, readable: open(key, row.ciphertext, binding(userId, row.provider)) !== null }]));
}
export async function savePersonalApiKey(db: PrismaClient, ownerId: string, provider: CoachingProvider, apiKey: string): Promise<void> {
  const key = encryptionKey();
  if (!key) throw new Error("Personal API keys are turned off.");
  const userId = requireOwnerId(ownerId);
  const data = { ciphertext: seal(key, apiKey, binding(userId, provider)), lastFour: apiKey.slice(-4) };
  await db.userApiKey.upsert({ where: { userId_provider: { userId, provider } }, create: { userId, provider, ...data }, update: data });
}
export async function deletePersonalApiKey(db: PrismaClient, ownerId: string, provider: CoachingProvider): Promise<void> {
  await db.userApiKey.deleteMany({ where: { userId: requireOwnerId(ownerId), provider } });
}
