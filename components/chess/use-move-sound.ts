"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function moveSound(san: string, gameOver = false) {
  if (gameOver || san.includes("#")) return "game-end.webm";
  if (san.includes("+")) return "move-check.mp3";
  if (san.includes("=")) return "promote.mp3";
  if (san.startsWith("O-O")) return "castle.mp3";
  if (san.includes("x")) return "capture.mp3";
  return "move-self.mp3";
}

export function useMoveSound() {
  const [muted, setMuted] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const stop = useCallback(() => { audio.current?.pause(); }, []);
  useEffect(() => stop, [stop]);

  const play = useCallback((san: string, gameOver = false) => {
    stop();
    if (muted) return;
    const clip = audio.current ??= new Audio();
    clip.src = `/sounds/${moveSound(san, gameOver)}`;
    // Playback can be blocked by browser settings or an unavailable device.
    void clip.play()?.catch(() => {});
  }, [muted, stop]);

  const toggleMuted = () => { stop(); setMuted(value => !value); };
  return { play, muted, toggleMuted };
}
