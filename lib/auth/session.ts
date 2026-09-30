import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./server";
import { readAuthConfig } from "./config";

export async function requireUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session.user;
}

/** Check authentication before parsing payloads or accessing private data. */
export async function requireApiUser(request?: Request) {
  try {
    if (request && !["GET", "HEAD"].includes(request.method) &&
      request.headers.get("origin") !== readAuthConfig(process.env).baseURL) {
      return Response.json({ error: { code: "FORBIDDEN", message: "Request origin is not allowed." } }, { status: 403 });
    }
    const session = await getAuth().api.getSession({ headers: request?.headers ?? await headers() });
    if (!session) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." } }, { status: 401 });
    return session.user;
  } catch {
    return Response.json({ error: { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Check the app configuration and database." } }, { status: 503 });
  }
}
