import Image from "next/image";

export const boardTheme = {
  boardImage: "/images/200.png",
  lastMoveFrom: "rgba(246, 214, 74, 0.42)",
  lastMoveTo: "rgba(246, 214, 74, 0.58)",
  lightNotation: "#654427",
  darkNotation: "#fff1d2",
};

export const customPieces = Object.fromEntries(
  ["w", "b"].flatMap(color => ["p", "n", "b", "r", "q", "k"].map(piece => [
    `${color}${piece.toUpperCase()}`,
    function PieceImage() {
      return <Image src={`/images/${color}${piece}.png`} alt="" width={150} height={150}
        unoptimized loading="eager" draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
    },
  ])),
);
