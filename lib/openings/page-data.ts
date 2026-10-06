import "server-only";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { openingRepository } from "./repository";
import { OpeningError } from "./content";
export async function openingForPage(id: string, ownerId: string) {
  try { return await openingRepository(getDb(), ownerId).get(id); }
  catch (error) { if (error instanceof OpeningError && error.status === 404) notFound(); throw error; }
}
