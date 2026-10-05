export type IconName = "home" | "games" | "import" | "puzzles" | "books" | "learning" | "plan" | "profile" | "settings" | "upload" | "check";
const paths: Record<IconName, React.ReactNode> = {
  upload: <><path d="M15 11v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4M9 12V2M5 6l4-4 4 4"/></>,
  check: <path d="M3 9l4 4 8-8"/>,
  home: <><rect x="2" y="2" width="6" height="6" rx="1.5"/><rect x="10" y="2" width="6" height="6" rx="1.5"/><rect x="2" y="10" width="6" height="6" rx="1.5"/><rect x="10" y="10" width="6" height="6" rx="1.5"/></>,
  games: <path d="M2 4h14M2 9h14M2 14h8"/>,
  import: <><rect x="2" y="2" width="14" height="14" rx="2"/><path d="M6 9h6M9 6v6"/></>,
  puzzles: <polygon points="9,2 11.5,7 17,7 13,11 14.5,16.5 9,13.5 3.5,16.5 5,11 1,7 6.5,7"/>,
  books: <><rect x="3" y="2" width="12" height="14" rx="1.5"/><path d="M6 6h6M6 9h6M6 12h3"/></>,
  learning: <><rect x="4" y="3" width="10" height="12" rx="1"/><path d="M7 7h4M7 10h2"/></>,
  plan: <><rect x="2" y="4" width="14" height="12" rx="1.5"/><path d="M6 4V2M12 4V2M2 8h14"/></>,
  profile: <><circle cx="9" cy="5" r="3"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"/></>,
  settings: <><circle cx="9" cy="9" r="3"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.1 4.1l1.4 1.4M12.5 12.5l1.4 1.4M4.1 13.9l1.4-1.4M12.5 5.5l1.4-1.4"/></>,
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
