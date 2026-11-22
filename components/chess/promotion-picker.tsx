"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const pieces = [
  { code: "q", name: "Queen" },
  { code: "r", name: "Rook" },
  { code: "n", name: "Knight" },
  { code: "b", name: "Bishop" },
];

export function PromotionPicker({ color, onChoose, onCancel }: {
  color: "w" | "b";
  onChoose: (piece: string) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-labelledby="promotion-title" onCancel={onCancel}
    className="fixed inset-0 m-auto w-[calc(100%_-_32px)] max-w-[360px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--fg)] shadow-xl backdrop:bg-black/60">
    <h2 id="promotion-title" className="text-lg font-semibold">Promote your pawn</h2>
    <p className="mt-2 text-sm text-[var(--fg-3)]">Choose a piece to complete your move.</p>
    <div className="mt-5 grid grid-cols-4 gap-2">{pieces.map(piece => <button key={piece.code} type="button"
      className="flex cursor-pointer flex-col items-center rounded-lg border border-[var(--border)] p-2 text-xs hover:bg-[var(--green-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={() => onChoose(piece.code)} aria-label={`Promote to ${piece.name.toLowerCase()}`}>
      <Image src={`/images/${color}${piece.code}.png`} alt="" width={56} height={56} unoptimized />
      <span className="mt-1">{piece.name}</span>
    </button>)}</div>
    <button type="button" onClick={onCancel} className="mt-5 cursor-pointer text-sm underline">Cancel move</button>
  </dialog>;
}
