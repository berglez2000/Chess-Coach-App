import Link from "next/link";
import type { GameSummary } from "@/types/saved-game";
import styles from "./game-library.module.css";

function outcome(game: GameSummary) {
  if (game.result === "1/2-1/2") return { label: "Draw", tone: styles.neutral };
  if (!["1-0", "0-1"].includes(game.result)) return { label: "Unfinished", tone: styles.neutral };
  const won = game.result === (game.userColor === "WHITE" ? "1-0" : "0-1");
  return { label: won ? "Win" : "Loss", tone: won ? styles.success : styles.loss };
}

function statusTone(status: GameSummary["status"]) {
  if (status === "COMPLETED") return styles.success;
  if (status === "FAILED") return styles.loss;
  if (status === "ENGINE_RUNNING" || status === "AI_RUNNING") return styles.progress;
  return styles.neutral;
}

export function GameSummaryList({ games }: { games: GameSummary[] }) {
  return (
    <ul className={styles.list}>{games.map(game => {
      const result = outcome(game);
      const title = `${game.whiteName ?? "White"} vs. ${game.blackName ?? "Black"}`;
      return <li key={game.id} className={styles.game}>
        <div className={styles.gameDetails}>
          <div className={styles.gameTitle}><Link href={`/games/${game.id}`} className={styles.reviewLink}>{title}</Link><span className={`${styles.badge} ${result.tone}`}>{result.label}</span></div>
          <p className={styles.metadata}>{game.playedAt ? `Played ${game.playedAt.slice(0, 10)}` : "Date unknown"}{game.openingName ? ` · ${game.openingName}` : ""}</p>
          <p className={styles.metadata}><span className={`${styles.colorDot} ${game.userColor === "WHITE" ? styles.white : styles.black}`} aria-hidden="true" />You played {game.userColor === "WHITE" ? "White" : "Black"}<span className={styles.separator} aria-hidden="true">·</span>Result: <span className={styles.score}>{game.result}</span></p>
        </div>
        <div className={styles.gameAside}>
          <span className={`${styles.badge} ${statusTone(game.status)}`}>Analysis: {game.status.toLowerCase().replaceAll("_", " ")}</span>
          <span className={styles.reviewHint} aria-hidden="true">Review game <span>→</span></span>
        </div>
      </li>;
    })}</ul>
  );
}
