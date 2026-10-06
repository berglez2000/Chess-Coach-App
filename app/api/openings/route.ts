import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { openingRepository } from "@/lib/openings/repository";
import { openingFailure, openingJson, readOpeningJson } from "@/lib/openings/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try { return openingJson({ openings: await openingRepository(getDb(), user.id).list() }); } catch (error) { return openingFailure(error); }
}
export async function POST(request: Request) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try { return openingJson({ opening: await openingRepository(getDb(), user.id).create(await readOpeningJson(request)) }, 201); } catch (error) { return openingFailure(error); }
}
