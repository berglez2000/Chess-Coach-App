import { requireUser } from "@/lib/auth/session";
import { SimplePage } from "@/components/ui/simple-page";
import { PlayWorkspace } from "@/components/play/workspace";
export default async function PlayPage() {
  await requireUser();
  return <SimplePage wide title="Play an engine" description="Choose Stockfish or human-like Maia and play from the starting board or your own position."><PlayWorkspace /></SimplePage>;
}
