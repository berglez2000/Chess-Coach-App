import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { openingRepository } from "@/lib/openings/repository";
import { SimplePage } from "@/components/ui/simple-page";
import styles from "@/components/openings/openings.module.css";
export default async function OpeningsPage() {
  const user = await requireUser(); const openings = await openingRepository(getDb(), user.id).list();
  return <SimplePage title="Openings" description="Build your repertoire, study your games, and practice your authored variations."><div className={styles.stack}>
    <div className={styles.actions}><Link href="/openings/new" className={styles.primary}>Add opening</Link></div>
    {!openings.length && <div className={styles.card}><h2>Your repertoire starts here</h2><p className={styles.muted}>Create an opening, enter branches on the board or import a PGN, and practice with automatic opponent replies.</p></div>}
    <div className={styles.grid}>{openings.map(opening => <article className={styles.card} key={opening.id}><h2><Link href={`/openings/${opening.id}`}>{opening.name}</Link></h2><p className={styles.muted}>{opening.color === "WHITE" ? "White" : "Black"} repertoire · {opening.count} variations · {opening.videos} videos</p><p className={styles.description}>{opening.description.slice(0, 240)}{opening.description.length > 240 ? "…" : ""}</p><div className={styles.actions}><Link href={`/openings/${opening.id}`} className={styles.button}>Study opening</Link>{opening.count > 0 && <Link href={`/openings/${opening.id}/practice`} className={styles.primary}>Practice</Link>}</div></article>)}</div>
  </div></SimplePage>;
}
