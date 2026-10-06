import shared from "@/components/ui/simple-page.module.css";
import styles from "@/components/games/game-library.module.css";

export default function LoadingGames() {
  return <main id="main-content" className={shared.page} aria-busy="true">
    <p className={shared.eyebrow}>Your chess journey</p>
    <h1 className={shared.heading}>Your games</h1>
    <p role="status" className={shared.description}>Loading your games…</p>
    <div className={styles.loading} aria-hidden="true">{[0, 1, 2].map(key => <div key={key} className={styles.skeleton} />)}</div>
  </main>;
}
