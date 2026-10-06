import { requireUser } from "@/lib/auth/session";
import type { Metadata } from "next";
import { ImportForm } from "@/components/games/import-form";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import shared from "@/components/ui/simple-page.module.css";
import styles from "@/components/games/import-form.module.css";

export const metadata: Metadata = { title: "Import a game | Chess Coach" };

export default async function NewGamePage() {
  await requireUser();
  return (
    <main id="main-content" className={shared.page}>
      <nav className={shared.breadcrumb} aria-label="Breadcrumb"><Link href="/games">Your games</Link><span aria-hidden="true">/</span><span>Import game</span></nav>
      <header>
        <p className={shared.eyebrow}>Learn from your own moves</p>
        <h1 className={shared.heading}>Import a game</h1>
        <p className={shared.description}>Bring a game you’ve played and turn it into your next lesson.</p>
      </header>
      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="game-details-title">
          <div className={styles.cardHeader}><span className={styles.icon}><Icon name="import" size={22} /></span><div><h2 id="game-details-title">Game details</h2><p>Choose your side, then paste one game’s PGN.</p></div></div>
          <ImportForm />
        </section>
        <aside className={styles.guide} aria-labelledby="pgn-guide-title">
          <span className={styles.icon}><Icon name="books" size={22} /></span>
          <h2 id="pgn-guide-title">Where do I find my PGN?</h2>
          <p>Open a completed game on your chess platform and look for its download or export option. Copy the PGN text and paste it here.</p>
          <div className={styles.tip}><h3>A quick check</h3><p>A PGN contains moves such as <code>1. e4 e5 2. Nf3 Nc6</code>. It may also include player names, the date, and the result in square brackets.</p></div>
          <div className={styles.next}><Icon name="learning" /><div><h3>What happens next?</h3><p>Your game is saved and opens in review to start analysis.</p></div></div>
        </aside>
      </div>
    </main>
  );
}
