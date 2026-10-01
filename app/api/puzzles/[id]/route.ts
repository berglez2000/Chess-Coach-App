import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { actOnPuzzle, findPracticePuzzle } from "@/lib/puzzles/practice-repository";
import { puzzleActionSchema } from "@/lib/puzzles/solve";

export const runtime = "nodejs";
const missing = () => Response.json({ error: { message: "Puzzle not found." } }, { status: 404 });
const unavailable = () => Response.json({ error: { message: "Could not save or load puzzle progress. Please refresh before retrying." } }, { status: 503 });
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try {
    const puzzle = await findPracticePuzzle(getDb(), (await params).id, user.id);
    return puzzle ? Response.json({ puzzle }, { headers: { "Cache-Control": "private, no-store" } }) : missing();
  } catch { return unavailable(); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  let input;
  try { input = puzzleActionSchema.safeParse(await request.json()); }
  catch { return Response.json({ error: { message: "Invalid puzzle action." } }, { status: 400 }); }
  if (!input.success) return Response.json({ error: { message: "Invalid puzzle action." } }, { status: 400 });
  try {
    const result = await actOnPuzzle(getDb(), (await params).id, user.id, input.data);
    if (result.status === "NOT_FOUND") return missing();
    if (result.status === "CONFLICT") return Response.json({ puzzle: result.puzzle, error: { message: "Progress changed in another request. The latest saved position is shown; try again." } }, { status: 409 });
    return Response.json({ puzzle: result.puzzle });
  } catch { return unavailable(); }
}
