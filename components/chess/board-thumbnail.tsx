import Image from "next/image";
import { Chess } from "chess.js";
import { boardTheme } from "./board-theme";
import styles from "./board-thumbnail.module.css";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Static, server-renderable miniature of a position using the wooden board and piece images. */
export function BoardThumbnail({ fen, whiteBottom = true, label }: { fen: string; whiteBottom?: boolean; label: string }) {
  let board: ReturnType<Chess["board"]>;
  try { board = new Chess(fen).board(); } catch { board = new Chess().board(); }
  // chess.js returns rank 8 first; flip rows and columns for a Black-bottom view.
  const rows = whiteBottom ? board : [...board].reverse().map(row => [...row].reverse());
  return <div className={styles.board} role="img" aria-label={label} style={{ backgroundImage: `url(${boardTheme.boardImage})` }}>
    {rows.flatMap((row, r) => row.map((piece, c) => {
      const square = whiteBottom ? `${FILES[c]}${8 - r}` : `${FILES[7 - c]}${r + 1}`;
      return piece
        ? <Image key={square} className={styles.piece} src={`/images/${piece.color}${piece.type}.png`} alt="" width={150} height={150} unoptimized draggable={false} />
        : <span key={square} />;
    }))}
  </div>;
}
