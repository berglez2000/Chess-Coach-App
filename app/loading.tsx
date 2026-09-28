import Link from "next/link";

export default function HomeLoading() {
  return <main id="main-content" className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
    <h1 className="text-3xl font-semibold">Chess Coach</h1>
    <p role="status" className="mt-4">Loading your saved games…</p>
    <Link href="/games/new" className="mt-6 inline-block underline">Import Game</Link>
    <Link href="/games" className="ml-6 inline-block underline">My Games</Link>
  </main>;
}
