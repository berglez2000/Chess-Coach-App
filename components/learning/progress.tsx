import styles from "./learning.module.css";
export function LearningProgress({ completed, total }: { completed: number; total: number }) {
  return <div className={styles.progress}><div className={styles.track} role="progressbar" aria-label="Exercises completed" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={completed}><div className={styles.fill} style={{ width: `${total ? completed / total * 100 : 0}%` }} /></div><span>{completed} / {total}</span></div>;
}
