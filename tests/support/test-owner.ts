import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

export async function createTestOwner(db: PrismaClient) {
  const id = randomUUID();
  await db.user.create({ data: { id, name: "Test owner", email: `${id}@example.test` } });
  return id;
}
