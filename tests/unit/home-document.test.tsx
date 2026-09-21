import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import RootLayout from "@/app/layout";
import HomePage from "@/app/page";

it("renders home navigation and a skip link to the page content on the server", () => {
  const html = renderToStaticMarkup(
    <RootLayout>
      <HomePage />
    </RootLayout>,
  );

  expect(html).toMatch(/<a\b[^>]*href="\/"[^>]*>Chess Coach<\/a>/);
  expect(html).toMatch(/<a\b[^>]*href="#main-content"[^>]*>Skip to content<\/a>/);
  expect(html).toMatch(/<main\b[^>]*id="main-content"/);
});
