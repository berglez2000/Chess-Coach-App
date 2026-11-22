export type IconName = "home" | "games" | "import" | "puzzles" | "books" | "learning" | "plan" | "profile" | "settings" | "upload" | "check" | "play" | "analysis" | "openings" | "endgames" | "history" | "arrow";
const paths: Record<IconName, React.ReactNode> = {
  upload: <><path d="M15 11v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4M9 12V2M5 6l4-4 4 4"/></>,
  check: <path d="M3 9l4 4 8-8"/>,
  home: <><rect x="2" y="2" width="6" height="6" rx="1.5"/><rect x="10" y="2" width="6" height="6" rx="1.5"/><rect x="2" y="10" width="6" height="6" rx="1.5"/><rect x="10" y="10" width="6" height="6" rx="1.5"/></>,
  games: <><rect x="2" y="2" width="14" height="14" rx="2"/><path d="M2 6.7h14M2 11.3h14M6.7 2v14M11.3 2v14"/></>,
  import: <><path d="M9 2v9M5.5 7.5L9 11l3.5-3.5"/><path d="M3 12v2a2 2 0 002 2h8a2 2 0 002-2v-2"/></>,
  puzzles: <polygon points="9,2 11.5,7 17,7 13,11 14.5,16.5 9,13.5 3.5,16.5 5,11 1,7 6.5,7"/>,
  books: <><path d="M3 3.5A1.5 1.5 0 014.5 2H8a1 1 0 011 1v12a1 1 0 00-1-1H4.5A1.5 1.5 0 013 12.5z"/><path d="M15 3.5A1.5 1.5 0 0013.5 2H10a1 1 0 00-1 1v12a1 1 0 011-1h3.5a1.5 1.5 0 001.5-1.5z"/></>,
  learning: <><path d="M2 6l7-3.5L16 6l-7 3.5z"/><path d="M5 7.6V12c0 1.3 1.8 2.5 4 2.5s4-1.2 4-2.5V7.6"/><path d="M16 6v4"/></>,
  plan: <><rect x="2" y="4" width="14" height="12" rx="1.5"/><path d="M6 4V2M12 4V2M2 8h14"/></>,
  profile: <><circle cx="9" cy="5.5" r="3"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"/></>,
  settings: <><circle cx="9" cy="9" r="2.5"/><path d="M9 1.8v2M9 14.2v2M1.8 9h2M14.2 9h2M3.9 3.9l1.4 1.4M12.7 12.7l1.4 1.4M3.9 14.1l1.4-1.4M12.7 5.3l1.4-1.4"/></>,
  play: <path d="M5 3.2v11.6c0 .8.9 1.3 1.6.9l9-5.8a1 1 0 000-1.8l-9-5.8c-.7-.4-1.6.1-1.6.9z"/>,
  analysis: <><circle cx="8" cy="8" r="5"/><path d="M11.6 11.6L16 16M6 8.5l1.5-2 1.5 3 1.5-2"/></>,
  openings: <><path d="M9 16V8"/><path d="M9 8c0-3 2-5 5-5v3c0 3-2 5-5 5"/><path d="M9 11c0-3-2-5-5-5v3c0 3 2 5 5 5"/></>,
  endgames: <><path d="M9 2v2.5M7.6 3.2h2.8"/><path d="M6.2 15h5.6M5 15c0-3.5.9-5.3 3-6.6 2.1 1.3 3 3.1 3 6.6"/><path d="M4.5 15h9l.8 1.5H3.7z"/></>,
  history: <><path d="M2.5 9a6.5 6.5 0 106.5-6.5c-2.3 0-4.3 1.2-5.5 3"/><path d="M3 2.5V6h3.5M9 5.5V9l2.5 1.5"/></>,
  arrow: <path d="M3 9h12M10 4l5 5-5 5"/>,
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
