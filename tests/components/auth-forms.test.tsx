import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signUp: { email: signUp } } }));
import { AuthForm } from "@/components/auth/auth-form";
import { ChangePassword } from "@/components/auth/change-password";

it("disables server-rendered password forms until hydration and never uses GET submission", () => {
  for (const form of [<AuthForm key="register" mode="register" />, <AuthForm key="login" mode="sign-in" />, <ChangePassword key="change" />]) {
    const html = renderToStaticMarkup(form);
    const container = document.createElement("div"); container.innerHTML = html;
    expect(container.querySelector("form")?.method).toBe("post");
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
  }
});
it("shows mismatched passwords without submitting credentials", () => {
  render(<AuthForm mode="register" />);
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Player" } });
  fireEvent.change(screen.getByLabelText("Email", { exact: true }), { target: { value: "player@example.test" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "first long passphrase" } });
  fireEvent.change(screen.getByLabelText("Confirm password", { exact: true }), { target: { value: "second long passphrase" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
  expect(signUp).not.toHaveBeenCalled();
});
