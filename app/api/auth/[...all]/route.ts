import { getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
async function handle(request: Request) {
  try { return await getAuth().handler(request); }
  catch { return Response.json({ error: { message: "Sign-in is temporarily unavailable. Check the app configuration and database." } }, { status: 503 }); }
}
export { handle as GET, handle as POST };
