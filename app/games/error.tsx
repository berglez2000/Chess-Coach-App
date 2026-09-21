"use client";
import Link from "next/link";

export default function GamesError({ retry }: { retry: () => void }) {
  return <main id="main-content" className="mx-auto max-w-5xl px-6 py-12">
    <h1 className="text-3xl font-semibold">Could not load your games</h1>
    <p role="alert" className="mt-4">The game library is temporarily unavailable. Please try again.</p>
    <button onClick={retry} className="mt-6 rounded-lg bg-[#20382e] px-5 py-3 text-white">Try again</button>
    <Link href="/" className="ml-6 underline">Home</Link>
  </main>;
}
