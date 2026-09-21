import type { Metadata } from "next";
import { ImportForm } from "@/components/games/import-form";

export const metadata: Metadata = { title: "Import a game | Chess Coach" };

export default function NewGamePage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Import a game</h1>
      <p className="mt-3 text-[#465c50]">Choose the side you played and paste your game’s PGN.</p>
      <ImportForm />
    </main>
  );
}
