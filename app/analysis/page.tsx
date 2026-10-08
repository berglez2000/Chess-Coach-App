import { requireUser } from "@/lib/auth/session";
import { SimplePage } from "@/components/ui/simple-page";
import { AnalysisWorkspace } from "@/components/analysis/workspace";
export default async function AnalysisPage() {
  await requireUser();
  return <SimplePage wide title="Analysis" description="Explore either side and compare Stockfish’s top three moves for any position."><AnalysisWorkspace /></SimplePage>;
}
