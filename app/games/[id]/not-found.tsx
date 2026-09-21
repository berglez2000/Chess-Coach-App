import Link from "next/link";
export default function GameNotFound() {
  return <main id="main-content" className="mx-auto max-w-5xl px-6 py-12">
    <h1 className="text-3xl font-semibold">Game not found</h1>
    <p className="mt-4">This saved game could not be found. Check the link or choose a game from your library.</p>
    <Link href="/games" className="mt-6 inline-block underline">Your games</Link>
  </main>;
}
