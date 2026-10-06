import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ErrorPage from "@/app/openings/error";
it("refetches the opening page using the current Next.js retry prop", () => {
  const retry = vi.fn(); render(<ErrorPage retry={retry} />); fireEvent.click(screen.getByRole("button", { name: "Try again" })); expect(retry).toHaveBeenCalledOnce();
});
