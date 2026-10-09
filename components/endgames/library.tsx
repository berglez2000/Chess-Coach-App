import Image from "next/image";
import Link from "next/link";
import { ENDGAME_CHAPTERS, chapterPositions } from "@/lib/endgames/catalog";
import { ReplayBoard } from "@/components/chess/replay-board";
import books from "@/components/books/book-library.module.css";
import styles from "./endgames.module.css";

type Chapter = (typeof ENDGAME_CHAPTERS)[number];

export function EndgameLibrary() {
  return <>
    <header className={books.pageHeader}>
      <nav className={books.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Endgames</span></nav>
      <h1 className={books.pageTitle}>Your endgame library</h1>
      <p className={books.pageSubtitle}>Explore endgames by chapter. Choose a position and practice it against Stockfish at your own pace.</p>
    </header>
    <section aria-labelledby="chapters-heading">
      <div className={books.sectionHeader}><h2 id="chapters-heading" className={books.sectionTitle}>Chapters</h2><span className={books.sectionCount}>{ENDGAME_CHAPTERS.length} chapters · {ENDGAME_CHAPTERS.reduce((total, chapter) => total + chapterPositions(chapter.id).length, 0)} positions</span></div>
      <ul className={books.booksGrid}>{ENDGAME_CHAPTERS.map((chapter, index) => <li className={books.bookCard} key={chapter.id}>
        <Link href={`/endgames/${chapter.id}`} className={styles.cover} aria-label={`Open ${chapter.title}`}>
          <span className={styles.chapterLabel}>Chapter {index + 1}</span>
          <span className={styles.pieces} aria-hidden="true">{chapter.pieces.map(piece => <Image key={piece} src={`/images/${piece}.png`} width={64} height={64} alt="" />)}</span>
          <span className={styles.coverTitle}>{chapter.title}</span>
        </Link>
        <div className={books.bookInfo}><h3 className={books.bookTitle}>{chapter.title}</h3><p className={books.bookMeta}>{chapterPositions(chapter.id).length} positions · Stockfish practice</p><p className={styles.description}>{chapter.description}</p><Link href={`/endgames/${chapter.id}`} className={`${books.actionButton} ${books.readButton} ${styles.open}`}>Open chapter</Link></div>
      </li>)}</ul>
    </section>
    <p className={styles.note}>Original and sourced practice positions. Sessions are temporary; download PGN to keep your game. Saved exercise progress is not available yet.</p>
  </>;
}

export function EndgameChapter({ chapter, page = 1, group }: { chapter: Chapter; page?: number; group?: string }) {
  const all = chapterPositions(chapter.id);
  const groups = Array.from(new Set(all.map(position => position.subtopic ?? "Introduction")));
  const selectedGroup = groups.includes(group ?? "") ? group : undefined;
  const positions = selectedGroup ? all.filter(position => (position.subtopic ?? "Introduction") === selectedGroup) : all;
  const pages = Math.max(1, Math.ceil(positions.length / 12));
  const current = Math.min(pages, Math.max(1, Number.isSafeInteger(page) ? page : 1));
  const offset = (current - 1) * 12;
  const visible = positions.slice(offset, offset + 12);
  const href = (pageNumber: number, selected = selectedGroup) => `/endgames/${chapter.id}?${new URLSearchParams({ page: String(pageNumber), ...(selected ? { group: selected } : {}) })}`;
  return <>
    <header className={books.pageHeader}>
      <nav className={books.breadcrumb} aria-label="Breadcrumb"><Link href="/endgames">Endgames</Link><span aria-hidden="true">/</span><span aria-current="page">{chapter.title}</span></nav>
      <h1 className={books.pageTitle}>{chapter.title}</h1><p className={books.pageSubtitle}>{chapter.description}</p>
    </header>
    <section aria-labelledby="positions-heading">
      <div className={books.sectionHeader}><h2 id="positions-heading" className={books.sectionTitle}>Practice positions</h2><span className={books.sectionCount}>{positions.length} positions</span></div>
      {groups.length > 1 && <nav className={styles.filters} aria-label="Position topics"><Link href={href(1, "")} aria-current={!selectedGroup ? "page" : undefined}>All positions</Link>{groups.map(item => <Link key={item} href={href(1, item)} aria-current={selectedGroup === item ? "page" : undefined}>{item}</Link>)}</nav>}
      <ul className={books.booksGrid}>{visible.map((position) => <li key={position.id} className={books.bookCard}>
        <div className={styles.preview}><ReplayBoard fen={position.fen} userColor={position.color} positionLabel={`${position.title} preview`} /></div>
        <div className={books.bookInfo}><p className={books.bookMeta}>Position {all.findIndex(item => item.id === position.id) + 1} · Play {position.color === "WHITE" ? "White" : "Black"}</p><h3 className={books.bookTitle}>{position.title}</h3>{position.subtopic && <p className={books.bookMeta}>{position.subtopic}</p>}<p className={styles.description}>{position.description}</p><p className={books.bookMeta}>Objective: {position.objective === "mate" ? "Checkmate" : "Hold a draw"}</p><Link className={`${books.actionButton} ${books.readButton} ${styles.open}`} href={`/endgames/${chapter.id}/${position.id}`}>Practice {position.title}</Link></div>
      </li>)}</ul>
    </section>
    {pages > 1 && <nav className={styles.filters} aria-label="Position pages">{current > 1 && <Link href={href(current - 1)}>Previous page</Link>}<span>Page {current} of {pages}</span>{current < pages && <Link href={href(current + 1)}>Next page</Link>}</nav>}
    <p className={styles.note}>Choose a difficulty on the practice screen. Hints and analysis are available when you need help. Objective feedback checks the final game outcome.</p>
  </>;
}
