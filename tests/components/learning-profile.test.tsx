import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LearningProfileForm } from "@/components/learning-profile/profile-form";
afterEach(() => vi.unstubAllGlobals());
function complete() {
  fireEvent.click(screen.getByLabelText("Reduce blunders")); fireEvent.click(screen.getByLabelText("Not sure", { selector: "input" }));
  fireEvent.click(screen.getByLabelText("Puzzles")); fireEvent.click(screen.getByLabelText("Tuesday"));
}
it("requires complete answers, reviews without saving, preserves edits on failed save and allows retry", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Session ended. Sign in again." } }) })
    .mockImplementationOnce(async (_url, options) => ({ ok: true, json: async () => ({ profile: { id: "snapshot", revision: 1, answers: JSON.parse(options.body).answers, resourceTitles: [], savedAt: new Date().toISOString() } }) }));
  vi.stubGlobal("fetch", fetch);
  render(<LearningProfileForm initial={null} resources={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Review answers" })); expect(screen.getByRole("alert")).toBeVisible(); expect(fetch).not.toHaveBeenCalled();
  complete(); fireEvent.click(screen.getByRole("button", { name: "Review answers" }));
  expect(screen.getByRole("heading", { name: "Review your answers" })).toBeVisible(); expect(screen.getByText("Rating unknown", { exact: false })).toBeVisible(); expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save learning profile" })); await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Session ended"));
  fireEvent.click(screen.getByRole("button", { name: "Back to editing" })); expect(screen.getByLabelText("Tuesday study minutes")).toHaveValue(20);
  fireEvent.click(screen.getByRole("button", { name: "Review answers" })); fireEvent.click(screen.getByRole("button", { name: "Save learning profile" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Your saved learning profile" })).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" })); expect(screen.getByLabelText("Reduce blunders")).toBeChecked();
});
it("treats Not sure as exclusive and supports per-day time and selected resources", () => {
  render(<LearningProfileForm initial={null} resources={[{ kind: "material", id: "m1", title: "Tactics book" }]} />);
  complete(); fireEvent.click(screen.getByLabelText("Openings")); expect(screen.getByLabelText("Not sure", { selector: "input" })).not.toBeChecked();
  fireEvent.click(screen.getByLabelText("Saturday")); fireEvent.change(screen.getByLabelText("Saturday study minutes"), { target: { value: "45" } });
  fireEvent.click(screen.getByLabelText("Tactics book (Learning material)")); fireEvent.click(screen.getByRole("button", { name: "Review answers" }));
  expect(screen.getByText("65 minutes across 2 study days")).toBeVisible(); expect(screen.getByText("Tactics book")).toBeVisible();
});
