import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { BoardRecorder } from "@/components/chesslink/recorder";
import shared from "@/components/ui/simple-page.module.css";

export const metadata = { title: "Record a board game | Chess Coach" };

export default async function RecordGamePage() {
  const user = await requireUser();
  return <main id="main-content" className={`${shared.page} ${shared.wide}`}>
    <nav className={shared.breadcrumb} aria-label="Breadcrumb"><Link href="/games">Your games</Link><span>/</span><span>Record board game</span></nav>
    <header><p className={shared.eyebrow}>Play on your physical board</p><h1 className={shared.heading}>Record a King Performance game</h1><p className={shared.description}>Connect ChessLink, capture your moves, and keep the game for review.</p></header>
    <BoardRecorder ownerId={user.id} playerName={user.name} />
  </main>;
}
