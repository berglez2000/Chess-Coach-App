import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { findReplay } from "@/lib/replay/repository";
import { ReplayWorkspace } from "@/components/replay/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Beat your past self | Chess Coach" };
export default async function ReplaySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const session = await findReplay(getDb(), id, user.id);
  if (!session) notFound();
  return <main id="main-content" className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8"><ReplayWorkspace key={id} initialSession={session} /></main>;
}
