import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/games/queries", () => ({ getDashboard: async () => ({ count: 0, recentGames: [] }) }));
import HomePage from "@/app/page";

it("renders home navigation and a skip link to the page content on the server", async () => {
  const html = renderToStaticMarkup(
    <RootLayout>
      {await HomePage()}
    </RootLayout>,
  );

  expect(html).toMatch(/<a\b[^>]*href="\/"[^>]*>Chess Coach<\/a>/);
  expect(html).toMatch(/<a\b[^>]*href="#main-content"[^>]*>Skip to content<\/a>/);
  expect(html).toMatch(/<main\b[^>]*id="main-content"/);
});
