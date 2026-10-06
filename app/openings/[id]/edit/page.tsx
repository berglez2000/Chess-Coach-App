import { requireUser } from "@/lib/auth/session";
import { openingForPage } from "@/lib/openings/page-data";
import { SimplePage } from "@/components/ui/simple-page";
import { OpeningEditor } from "@/components/openings/editor";
export default async function EditOpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const opening = await openingForPage((await params).id, user.id);
  return <SimplePage wide title={`Edit ${opening.name}`} description="Navigate moves, branch from any position, and save your repertoire."><OpeningEditor key={opening.id} initial={opening} /></SimplePage>;
}
