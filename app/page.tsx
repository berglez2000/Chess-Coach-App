import Link from "next/link";

export default function HomePage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-6 py-20 sm:px-10 sm:py-28">
      <p className="text-sm font-semibold tracking-widest uppercase">
        Your games. Your lessons.
      </p>
      <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
        Learn from every move.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-[#465c50]">
        A place to revisit your games, understand important decisions, and bring
        those lessons to your next game.
      </p>
      <Link href="/games/new" className="mt-10 inline-block rounded-lg bg-[#20382e] px-6 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4">
        Import a game
      </Link>
      <Link href="/games" className="ml-6 inline-block underline">Your games</Link>
    </main>
  );
}
