import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { mutate } from "@/lib/learning/repository";
import { LearningError } from "@/lib/learning/content";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try {
    const text = await request.text(); if (text.length > 30000) throw new LearningError("The exercise is too large.");
    return Response.json(await mutate(getDb(), user.id, JSON.parse(text)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof LearningError) return Response.json({ error: { message: error.message } }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: { message: "Check the required fields and input lengths." } }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: { message: "This exercise number already exists in the chapter." } }, { status: 409 });
    return Response.json({ error: { message: "Could not save learning content. Please refresh before retrying." } }, { status: 503 });
  }
}
