import shared from "@/components/ui/simple-page.module.css";
import styles from "@/components/openings/openings.module.css";
export default function Loading() {
  return <main id="main-content" className={`${shared.page} ${shared.wide}`} aria-busy="true">
    <header className={styles.header}><div><h1 className={shared.heading}>Openings</h1><p className={shared.description}>Loading your repertoire…</p></div></header>
    <p role="status" className="sr-only">Loading openings</p>
    <ul className={styles.grid} aria-hidden="true">{[0, 1, 2].map(i => <li key={i} className={`${styles.opening} ${styles.skeleton}`}><div className={styles.thumbSkeleton} /><div className={styles.body}><div className={styles.lineSkeleton} style={{ width: "40%" }} /><div className={styles.lineSkeleton} style={{ width: "70%", height: 18 }} /><div className={styles.lineSkeleton} style={{ width: "85%" }} /></div></li>)}</ul>
  </main>;
}
