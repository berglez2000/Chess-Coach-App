import { requireUser } from "@/lib/auth/session";
import { SimplePage } from "@/components/ui/simple-page";
import { OpeningEditor } from "@/components/openings/editor";
export default async function NewOpeningPage() { await requireUser(); return <SimplePage wide title="Add opening" description="Enter a name, choose your practice color, and build legal variations."><OpeningEditor /></SimplePage>; }
