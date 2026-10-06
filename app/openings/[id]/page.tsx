import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { openingRepository } from "@/lib/openings/repository";
import { openingForPage } from "@/lib/openings/page-data";
import { position } from "@/lib/openings/content";
import { SimplePage } from "@/components/ui/simple-page";
import { OpeningVideos } from "@/components/openings/videos";
import { ReplayBoard } from "@/components/chess/replay-board";
import styles from "@/components/openings/openings.module.css";
export default async function OpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const opening = await openingForPage(id, user.id); const games = await openingRepository(getDb(), user.id).related(id);
  return <SimplePage wide title={opening.name} description={`${opening.color === "WHITE" ? "White" : "Black"} repertoire · ${opening.lines.length} authored variations`}><div className={styles.stack}>
    <div className={styles.actions}><Link href="/openings" className={styles.button}>All openings</Link><Link href={`/openings/${id}/edit`} className={styles.button}>Edit opening</Link>{opening.lines.length > 0 && <Link href={`/openings/${id}/practice`} className={styles.primary}>Practice variations</Link>}</div>
    <div className={styles.layout}><section className={`${styles.card} ${styles.boardCard}`}><h2>Starting position</h2><ReplayBoard fen={opening.startFen} userColor={opening.color} positionLabel="Opening starting" /></section><section className={styles.card}><h2>About this opening</h2><p className={styles.description}>{opening.description || "Add a description in the opening editor."}</p><h2 className="mt-6">Variations</h2>{!opening.lines.length && <p className={styles.muted}>Add moves in the editor to start practicing.</p>}{opening.lines.map((line, index) => <details className={styles.line} key={index}><summary>{line.name}</summary><p className={styles.description}>{position(opening.startFen, line.moves).history().join(" · ")}</p></details>)}</section></div>
    <OpeningVideos opening={opening} />
    <section className={styles.card}><h2>Your games in this opening</h2><p className={styles.muted}>Matches any authored position after at least four plies (or a custom starting position), including transpositions. Searches the first 40 plies and shows the latest 50 matching games. Very short variations from the normal start do not match games.</p>{games.length ? games.map(game => <div className={styles.line} key={game.id}><Link href={`/games/${game.id}`}>{game.whiteName || "White"} vs {game.blackName || "Black"} · {game.result}</Link></div>) : <p className={styles.status}>No matching saved games yet.</p>}</section>
  </div></SimplePage>;
}
