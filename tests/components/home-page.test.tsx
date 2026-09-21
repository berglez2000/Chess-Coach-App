import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("Home page", () => {
  it("introduces the app in the main content landmark", () => {
    render(<HomePage />);

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(
      within(main).getByRole("heading", {
        level: 1,
        name: "Learn from every move.",
      }),
    ).toBeVisible();
  });

  it("links to the game import form", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("link", { name: "Import a game" }),
    ).toHaveAttribute("href", "/games/new");
  });
});
