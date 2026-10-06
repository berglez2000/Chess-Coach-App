import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./simple-page.module.css";

type PageProps = { title: string; description: string; children: ReactNode; wide?: boolean };

export function SimplePage({ title, description, children, wide = false }: PageProps) {
  return <main id="main-content" className={`${styles.page} ${wide ? styles.wide : ""}`}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Dashboard</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
    <header><p className={styles.eyebrow}>Your workspace</p><h1 className={styles.heading}>{title}</h1><p className={styles.description}>{description}</p></header>
    <div className={styles.content}>{children}</div>
  </main>;
}

export function AuthPage({ title, description, children }: PageProps) {
  return <main id="main-content" className={styles.publicPage}>
    <Link href="/" className={styles.brand}><span className={styles.brandMark}><svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3v3M7.5 4.5h3M5 14h8l1 2H4l1-2zM5 14c0-4.5 1-6.5 4-8 3 1.5 4 3.5 4 8" /></svg></span>Chess Coach</Link>
    <div className={styles.card}><p className={styles.eyebrow}>Learn from every move</p><h1 className={styles.heading}>{title}</h1><p className={styles.description}>{description}</p>{children}</div>
  </main>;
}
