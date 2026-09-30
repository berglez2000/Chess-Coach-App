import "server-only";
import { getDb } from "@/lib/db/client";
import { createAuth } from "./create-auth";

let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return auth ??= createAuth(getDb(), process.env); }
