import { requireUser } from "@/lib/auth/session";
import { GameSummaryList } from "@/components/games/game-summary-list";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listGames } from "@/lib/games/queries";
import { Icon } from "@/components/ui/icon";
import shared from "@/components/ui/simple-page.module.css";
import styles from "@/components/games/game-library.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your games | Chess Coach" };

export default async function GamesPage() {
  const user = await requireUser();
  const games = await listGames(getDb(), user.id);
  const completed = games.filter(game => game.status === "COMPLETED").length;
  const inProgress = games.filter(game => ["ENGINE_RUNNING", "AI_RUNNING"].includes(game.status)).length;
  return <main id="main-content" className={shared.page}>
    <header className={styles.header}>
      <div>
        <p className={shared.eyebrow}>Your chess journey</p>
        <h1 className={shared.heading}>Your games</h1>
        <p className={shared.description}>Every game has a lesson. Revisit your moves and find your next improvement.</p>
      </div>
      <div className="flex flex-wrap gap-3"><Link href="/games/record" className={shared.primary}>Record board game</Link><Link href="/games/new" className={shared.primary}><Icon name="import" />Import a game</Link></div>
    </header>
    {games.length === 0 ? <section className={styles.empty} aria-labelledby="empty-title">
      <span className={styles.emptyIcon}><Icon name="games" size={28} /></span>
      <h2 id="empty-title">No saved games yet</h2>
      <p>Import your first game to start reviewing. Bring a PGN from your favorite chess platform and learn from the moves you played.</p>
      <Link href="/games/new" className={shared.link}>Import your first game <span aria-hidden="true">→</span></Link>
    </section> : <>
      <dl className={styles.stats} aria-label="Game library summary">
        {[{ label: "Saved games", value: games.length, icon: "games" }, { label: "Analysis complete", value: completed, icon: "check" }, { label: "Analysis in progress", value: inProgress, icon: "learning" }].map(stat => <div key={stat.label} className={styles.stat}>
          <dt><Icon name={stat.icon as "games" | "check" | "learning"} />{stat.label}</dt><dd>{stat.value}</dd>
        </div>)}
      </dl>
      <section aria-labelledby="library-title">
        <div className={styles.sectionHeader}><h2 id="library-title">Game library <span className={styles.count}>{games.length}</span></h2><p>Newest imports first</p></div>
        <GameSummaryList games={games} />
      </section>
    </>}
  </main>;
}
