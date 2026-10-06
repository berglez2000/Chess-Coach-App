import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { openingForPage } from "@/lib/openings/page-data";
import { SimplePage } from "@/components/ui/simple-page";
import { OpeningPractice } from "@/components/openings/practice";
import styles from "@/components/openings/openings.module.css";
export default async function PracticeOpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const opening = await openingForPage((await params).id, user.id);
  return <SimplePage wide title={`Practice ${opening.name}`} description="Recall your moves while the opponent follows your authored variations."><div className={styles.stack}><Link className={styles.button} href={`/openings/${opening.id}`}>Back to opening</Link><OpeningPractice key={`${opening.id}:${opening.revision}`} content={opening} /></div></SimplePage>;
}
