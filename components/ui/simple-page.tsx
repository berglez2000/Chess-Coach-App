import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "./app-shell";
import styles from "./simple-page.module.css";

type PageProps = { title: string; description: string; children: ReactNode; wide?: boolean };

export function SimplePage({ title, description, children, wide = false }: PageProps) {
  return <main id="main-content" className={`${styles.page} ${wide ? styles.wide : ""}`}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Dashboard</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
    <header><h1 className={styles.heading}>{title}</h1><p className={styles.description}>{description}</p></header>
    <div className={styles.content}>{children}</div>
  </main>;
}

export function AuthPage({ title, description, children }: PageProps) {
  return <main id="main-content" className={styles.publicPage}>
    <Link href="/" className={styles.brand}><BrandMark size={34} />Chess Coach</Link>
    <div className={styles.card}><h1 className={styles.heading}>{title}</h1><p className={styles.description}>{description}</p>{children}</div>
  </main>;
}
