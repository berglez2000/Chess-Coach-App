vi.mock("@/components/auth/account-menu", () => ({ AccountMenu: () => null }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "test-user", name: "Test user" }), requireApiUser: async () => ({ id: "test-user", name: "Test user" }) }));
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/games/dashboard", () => ({ getDashboardOverview: async () => ({ count: 0, recentGames: [], puzzles: 0, books: 0, exerciseCompleted: 0, exerciseTotal: 0, plan: null, progress: [] }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import HomePage from "@/app/page";

it("renders home navigation and a skip link to the page content on the server", async () => {
  const html = renderToStaticMarkup(
    <RootLayout>
      {await HomePage()}
    </RootLayout>,
  );

  expect(html).toContain("Chess");
  expect(html).toMatch(/href="\/openings"/);
  expect(html).toMatch(/<a\b[^>]*href="#main-content"[^>]*>Skip to content<\/a>/);
  expect(html).toMatch(/<main\b[^>]*id="main-content"/);
});
