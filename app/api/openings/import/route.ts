import { requireApiUser } from "@/lib/auth/session";
import { openingFailure, openingJson, readOpeningJson } from "@/lib/openings/http";
import { importOpeningUrl } from "@/lib/openings/url-import";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try { return openingJson(await importOpeningUrl(await readOpeningJson(request))); }
  catch (error) { return openingFailure(error); }
}
