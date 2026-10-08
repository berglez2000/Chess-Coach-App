import { requireUser } from "@/lib/auth/session";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getDashboardOverview } from "@/lib/games/dashboard";
import { Icon, type IconName } from "@/components/ui/icon";
import styles from "@/components/dashboard/dashboard.module.css";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
const c = (name: string) => styles[name];
function Card({ title, href, action, children }: { title: string; href?: string; action?: string; children: ReactNode }) {
  return <section className={c("card")} aria-label={title}><div className={c("card-header")}><h2 className={c("card-title")}>{title}</h2>{href && <Link href={href} className={c("card-action")}>{action}</Link>}</div>{children}</section>;
}
function Progress({ completed, total }: { completed: number; total: number }) {
  return <div className={c("progress-track")} role="progressbar" aria-label="Exercises completed" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total || 1}><div className={c("progress-fill")} style={{ width: `${total ? completed / total * 100 : 0}%` }}/></div>;
}
export default async function HomePage() {
  const user = await requireUser();
  let dashboard: Awaited<ReturnType<typeof getDashboardOverview>> | null = null;
  try { dashboard = await getDashboardOverview(getDb(), user.id); } catch { /* Keep navigation available during database outages. */ }
  const now = new Date();
  const timezone = "Europe/Ljubljana";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone }).format(now);
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const sessions = dashboard?.plan?.definition.sessions.filter(session => session.day === day) ?? [];
  const minutes = sessions.reduce((total, session) => total + session.minutes, 0);
  const quick: { href: string; label: string; icon: IconName; sub: string }[] = [
    { href: "/play", label: "Play an engine", icon: "games", sub: "Choose your opponent’s difficulty" },
    { href: "/analysis", label: "Analysis", icon: "games", sub: "Explore the top three engine moves" },
    { href: "/openings", label: "Openings", icon: "games", sub: "Study and practice your repertoire" },
    { href: "/puzzles", label: "Puzzles", icon: "puzzles", sub: dashboard ? `${dashboard.puzzles} generated from your games` : "Practice your game positions" },
    { href: "/learning", label: "Books", icon: "books", sub: dashboard ? `${dashboard.books} PDFs uploaded` : "Your reading library" },
    { href: "/learning/materials", label: "Study materials", icon: "learning", sub: dashboard ? `${dashboard.exerciseCompleted} / ${dashboard.exerciseTotal} exercises` : "Study and practice" },
    { href: "/learning/plan", label: "Weekly plan", icon: "plan", sub: minutes ? `${minutes} min today` : "Plan your study time" },
  ];
  return <main id="main-content" className={c("main-content")}>
    <div className={c("page-header")}><p className={c("page-kicker")}>{date}</p><h1 className={c("page-title")}>{greeting}, {user.name.trim().split(/\s+/)[0] || "there"}.</h1><p className={c("page-subtitle")}>{minutes ? `You have ${minutes} minutes of study in your plan today.` : "Revisit your games, practice your puzzles, and bring those lessons to your next game."}</p></div>
    <div className={c("cta-strip")}><Link href="/games/new" className={c("btn-primary")}><Icon name="import" size={15}/>Import game</Link><Link href="/games" className={c("btn-secondary")}><Icon name="games" size={15}/>My games</Link></div>
    {!dashboard && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-white p-5"><p>Could not load your dashboard. Check that local PostgreSQL is running, then try again.</p>{/* A full reload retries the server data read. */}{/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
<a href="/" className="mt-2 inline-block underline">Try again</a></div>}
    <div className={c("stats-row")}>
      <div className={c("stat-card")}><p className={c("stat-kicker")}>Games saved</p><p className={c("stat-num")}>{dashboard?.count ?? "—"}</p><p className={c("stat-label")}>Total imported games</p></div>
      <div className={c("stat-card")}><p className={c("stat-kicker")}>Puzzles</p><p className={c("stat-num")}>{dashboard?.puzzles ?? "—"}</p><p className={c("stat-label")}>Generated from your games</p></div>
      <div className={c("stat-card")}><p className={c("stat-kicker")}>Exercises done</p><p className={c("stat-num")}>{dashboard?.exerciseCompleted ?? "—"}{dashboard && <span className="text-base font-normal text-[var(--fg-3)]">/{dashboard.exerciseTotal}</span>}</p><div className="mt-3"><Progress completed={dashboard?.exerciseCompleted ?? 0} total={dashboard?.exerciseTotal ?? 0}/></div></div>
      <div className={c("stat-card")}><p className={c("stat-kicker")}>Books</p><p className={c("stat-num")}>{dashboard?.books ?? "—"}</p><p className={c("stat-label")}>PDFs uploaded</p></div>
    </div>
    <div className={c("dashboard-grid")}><div><Card title="Recent games" href="/games" action="View all">
      {dashboard?.recentGames.length ? <div className={c("game-list")}>{dashboard.recentGames.map(game => {
        const won = game.result === (game.userColor === "WHITE" ? "1-0" : "0-1");
        const resultClass = game.result === "1/2-1/2" || game.result === "*" ? "result-draw" : won ? "result-win" : "result-loss";
        const status = { PENDING: "Pending", ENGINE_RUNNING: "Analyzing", ENGINE_COMPLETED: "Engine done", AI_RUNNING: "Coaching", COMPLETED: "Analyzed", FAILED: "Failed" }[game.status];
        return <Link key={game.id} href={`/games/${game.id}`} className={c("game-row")}><div className={c("game-board-thumb")} aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <span key={i} className={`${c("sq")} ${c((Math.floor(i / 4) + i % 4) % 2 ? "sq-d" : "sq-l")}`}/>)}</div><div className={c("game-meta")}><p className={c("game-players")}>{game.whiteName ?? "White"} vs. {game.blackName ?? "Black"}</p><p className={c("game-info")}>{game.openingName ?? "Opening not recorded"} · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(game.playedAt ?? game.createdAt))}</p></div><span className={`${c("game-result")} ${c(resultClass)}`}>{game.result === "1/2-1/2" ? "½–½" : game.result === "*" ? "Unfinished" : game.result.replace("-", "–")}</span><span className={`${c("analysis-badge")} ${c(game.status === "COMPLETED" ? "analysis-done" : game.status === "PENDING" ? "analysis-pending" : "analysis-partial")}`}>{status}</span></Link>;
      })}</div> : <div className={c("empty-state")}><div className={c("empty-icon")}><Icon name="games" size={22}/></div><p className={c("empty-title")}>{dashboard ? "No games yet" : "Games unavailable"}</p><p className={c("empty-body")}>{dashboard ? "Import your first game to start reviewing and building your personal puzzle set." : "Try again to load your saved games."}</p>{dashboard && <Link href="/games/new" className={`${c("btn-primary")} mt-4`}>Import game</Link>}</div>}
    </Card></div><div className={c("side-panels")}>
      <Card title="Quick access"><div className={c("quick-grid")}>{quick.map(item => <Link key={item.href} href={item.href} className={c("quick-item")}><span className={`${c("quick-icon")} ${c(`quick-icon-${item.icon === "learning" ? "learn" : item.icon}`)}`}><Icon name={item.icon} size={16}/></span><p className={c("quick-label")}>{item.label}</p><p className={c("quick-sub")}>{item.sub}</p></Link>)}</div></Card>
      <Card title="Today's sessions" href="/learning/plan" action="Edit plan">{sessions.length ? <><div className={c("plan-day")}><p className={c("plan-day-name")}>{day.slice(0, 3)}</p><div className={c("plan-sessions")}>{sessions.map((session, index) => <div key={index} className={c("plan-session")}><span className={`${c("plan-session-pill")} ${c(session.activity.includes("puzzles") || session.activity === "Tactics" ? "session-tactics" : session.activity === "Game review" ? "session-games" : "session-study")}`}>{session.activity}</span><span className={c("plan-time")}>{session.minutes} min</span></div>)}</div></div><div className={c("plan-footer")}>{minutes} min total · <Link href="/learning/plan">View full week</Link></div></> : <div className={`${c("card-body")} text-sm text-[var(--fg-3)]`}>{!dashboard ? "Your plan is unavailable right now." : dashboard.plan ? "No sessions planned today. Enjoy a rest day or explore your library." : "Create and accept a weekly plan to see your sessions here."}</div>}</Card>
      <Card title="Learning progress" href="/learning/materials" action="Go to library"><div className={c("progress-list")}>{dashboard?.progress.length ? dashboard.progress.slice(0, 3).map(material => <div key={material.id}><div className={c("progress-label")}><Link href={`/learning/${material.id}`} className="font-medium hover:underline">{material.title}</Link><span>{material.completed} / {material.total}</span></div><Progress completed={material.completed} total={material.total}/>{(!material.completed || material.completed === material.total) && <p className="mt-1 text-[11px] text-[var(--fg-3)]">{material.total && material.completed === material.total ? "Complete" : "Not started"}</p>}</div>) : <p className="text-sm text-[var(--fg-3)]">{dashboard ? "Add learning materials to start tracking your progress." : "Learning progress is unavailable right now."}</p>}</div></Card>
    </div></div>
  </main>;
}
