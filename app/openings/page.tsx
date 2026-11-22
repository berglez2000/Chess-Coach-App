import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { openingRepository } from "@/lib/openings/repository";
import { Icon } from "@/components/ui/icon";
import { BoardThumbnail } from "@/components/chess/board-thumbnail";
import shared from "@/components/ui/simple-page.module.css";
import styles from "@/components/openings/openings.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Openings | Chess Coach" };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default async function OpeningsPage() {
  const user = await requireUser();
  const openings = await openingRepository(getDb(), user.id).list();
  const variations = openings.reduce((sum, opening) => sum + opening.count, 0);
  const videos = openings.reduce((sum, opening) => sum + opening.videos, 0);
  const white = openings.filter(opening => opening.color === "WHITE").length;
  return <main id="main-content" className={`${shared.page} ${shared.wide}`}>
    <header className={styles.header}>
      <div>
        <h1 className={shared.heading}>Openings</h1>
        <p className={shared.description}>Build your repertoire, study your games, and practice your authored variations.</p>
      </div>
      <Link href="/openings/new" className={shared.primary}><Icon name="openings" />Add opening</Link>
    </header>
    {openings.length === 0 ? <section className={styles.empty} aria-labelledby="empty-title">
      <span className={styles.emptyIcon}><Icon name="openings" size={28} /></span>
      <h2 id="empty-title">Your repertoire starts here</h2>
      <p>Create an opening, enter branches on the board or import a PGN, and practice with automatic opponent replies.</p>
      <Link href="/openings/new" className={shared.link}>Add your first opening <span aria-hidden="true">→</span></Link>
    </section> : <>
      <dl className={styles.stats} aria-label="Repertoire summary">
        {[
          { label: "Openings", value: openings.length, hint: `${white} as White · ${openings.length - white} as Black` },
          { label: "Variations", value: variations, hint: "Authored lines to practice" },
          { label: "Videos", value: videos, hint: "Attached study material" },
        ].map(stat => <div key={stat.label} className={styles.stat}><dt>{stat.label}</dt><dd>{stat.value}</dd><p>{stat.hint}</p></div>)}
      </dl>
      <section aria-labelledby="repertoire-title">
        <div className={styles.sectionHeader}><h2 id="repertoire-title">Your repertoire <span className={styles.count}>{openings.length}</span></h2><p>Recently edited first</p></div>
        <ul className={styles.grid}>{openings.map(opening => {
          const isWhite = opening.color === "WHITE";
          return <li key={opening.id} className={styles.opening}>
            <Link href={`/openings/${opening.id}`} className={styles.thumb} aria-label={`Study ${opening.name}`}>
              <BoardThumbnail fen={opening.preview.fen} whiteBottom={isWhite} label={`${opening.name} after ${opening.preview.moves || "the starting position"}`} />
            </Link>
            <div className={styles.body}>
              <div className={styles.colorRow}><span className={`${styles.colorDot} ${isWhite ? styles.white : styles.black}`} aria-hidden="true" />{isWhite ? "White" : "Black"} repertoire</div>
              <h3 className={styles.title}><Link href={`/openings/${opening.id}`}>{opening.name}</Link></h3>
              {opening.preview.moves ? <p className={styles.mainline} title={opening.preview.line ?? undefined}>{opening.preview.moves}</p> : <p className={styles.mainlineEmpty}>No variations yet</p>}
              {opening.description && <p className={styles.excerpt}>{opening.description}</p>}
              <div className={styles.meta}>
                <span className={styles.chip}>{plural(opening.count, "variation")}</span>
                {opening.plies > 0 && <span className={styles.chip}>{plural(opening.plies, "move")}</span>}
                {opening.videos > 0 && <span className={styles.chip}><Icon name="play" size={12} />{plural(opening.videos, "video")}</span>}
              </div>
            </div>
            <div className={styles.cardActions}>
              <Link href={`/openings/${opening.id}`} className={styles.button}>Study</Link>
              {opening.count > 0 && <Link href={`/openings/${opening.id}/practice`} className={styles.primary}><Icon name="play" size={14} />Practice</Link>}
              <Link href={`/openings/${opening.id}/edit`} className={styles.ghost}>Edit</Link>
            </div>
          </li>;
        })}</ul>
      </section>
    </>}
  </main>;
}
