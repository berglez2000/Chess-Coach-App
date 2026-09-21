import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Coach",
  description: "Learn from your own games, one move at a time.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:p-3"
        >
          Skip to content
        </a>
        <header className="border-b border-[#20382e]/15">
          <div className="mx-auto flex max-w-5xl items-center px-6 py-6 sm:px-10">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Chess Coach
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
