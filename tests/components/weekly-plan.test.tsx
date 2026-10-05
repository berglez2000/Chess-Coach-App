import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WeeklyPlanEditor } from "@/components/weekly-plan/plan-editor";
import { EMPTY_PLAN_STATE, type PlanState } from "@/lib/weekly-plan/contract";
import { planProfile, fixtureInputs, fixturePlan } from "../support/weekly-plan-fixtures";
const settings = { provider: "OPENAI" as const, available: { OPENAI: true, ANTHROPIC: true } };
const draft = { id: "draft-1", revision: 0, definition: fixturePlan, provider: "OPENAI" as const, model: "fixture-model", inputs: fixtureInputs, createdAt: "2026-10-04T10:00:00.000Z" };
const preview: PlanState = { revision: 2, accepted: null, draft, generation: { id: draft.id, status: "READY", error: null, leaseUntil: "2026-10-04T10:02:00.000Z" } };
const renderPlan = (state = EMPTY_PLAN_STATE) => render(<WeeklyPlanEditor initial={state} profile={planProfile} settings={settings} availableKeys={["chapter:chapter-1", "puzzles"]} />);
afterEach(() => vi.unstubAllGlobals());
it("loads without provider calls and requires profile and configured provider", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); render(<WeeklyPlanEditor initial={EMPTY_PLAN_STATE} profile={null} settings={settings} availableKeys={[]} />);
  expect(screen.getByRole("button", { name: "Generate weekly plan" })).toBeDisabled(); expect(fetch).not.toHaveBeenCalled();
});
it("previews generic and linked activities, validates edits, and accepts only saved changes", async () => {
  const edited = { ...preview, revision: 3, draft: { ...draft, revision: 1, definition: { ...fixturePlan, title: "My weekly study" } } };
  const accepted = { ...edited, revision: 4, accepted: { ...edited.draft, id: "accepted-1", version: 1, generationId: draft.id, draftRevision: 1, acceptedAt: "2026-10-04T10:01:00.000Z" } };
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ state: edited }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ state: accepted }) }); vi.stubGlobal("fetch", fetch);
  renderPlan(preview); expect(screen.getByText("Generic study · choose your own resource")).toBeVisible();
  expect(screen.getByRole("link", { name: "Tactics book / Mate in One" })).toHaveAttribute("href", "/learning/chapters/chapter-1");
  fireEvent.click(screen.getByRole("button", { name: "Edit proposal" })); fireEvent.change(screen.getByLabelText("Session 1 minutes"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Save proposal changes" })); expect(screen.getByRole("alert")).toHaveTextContent("Tuesday must total 20"); expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Session 1 minutes"), { target: { value: "20" } }); fireEvent.change(screen.getByLabelText("Plan title"), { target: { value: "My weekly study" } });
  fireEvent.click(screen.getByRole("button", { name: "Save proposal changes" })); await waitFor(() => expect(screen.getByRole("status", { name: "Weekly plan feedback" })).toHaveTextContent("Proposal changes saved"));
  expect(screen.queryByRole("region", { name: "Accepted weekly plan" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Accept weekly plan" })); await waitFor(() => expect(screen.getByRole("region", { name: "Accepted weekly plan" })).toBeVisible());
  expect(screen.getByText("My weekly study")).toBeVisible(); expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ action: "ACCEPT", draftRevision: 1 });
});
it("preserves the accepted plan after failed regeneration and reuses lost-response request IDs", async () => {
  const accepted = { ...draft, id: "accepted-1", version: 1, generationId: draft.id, draftRevision: 0, acceptedAt: "2026-10-04T10:00:00.000Z" };
  const initial = { ...preview, accepted };
  const failed = { ...initial, revision: 4, generation: { ...preview.generation!, status: "FAILED" as const, error: "Provider timed out" } };
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Lost response"))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ state: failed }) }); vi.stubGlobal("fetch", fetch);
  renderPlan(initial); fireEvent.click(screen.getByRole("button", { name: "Generate new proposal" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry same request" })).toBeVisible());
  expect(within(screen.getByRole("region", { name: "Accepted weekly plan" })).getByText("Accepted version 1")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry same request" })); await waitFor(() => expect(screen.getByRole("alert", { name: "Plan generation feedback" })).toHaveTextContent("Provider timed out"));
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(JSON.parse(fetch.mock.calls[1][1].body));
});
it("allows adding/removing sessions and cancelling local changes without saves", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); renderPlan(preview);
  fireEvent.click(screen.getByRole("button", { name: "Edit proposal" })); fireEvent.click(screen.getByRole("button", { name: "Add session" }));
  expect(screen.getByLabelText("Session 4 minutes")).toHaveValue(5); fireEvent.click(screen.getByRole("button", { name: "Remove session 4" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel edits" })); expect(screen.getByRole("button", { name: "Accept weekly plan" })).toBeVisible(); expect(fetch).not.toHaveBeenCalled();
});

it("shows a regenerated proposal even if its content matches the accepted plan", () => {
  const accepted = { ...draft, id: "accepted-1", version: 1, generationId: draft.id, draftRevision: 0, acceptedAt: "2026-10-04T10:00:00.000Z" };
  renderPlan({ ...preview, accepted, draft: { ...draft, id: "new-generation" } });
  expect(screen.getByRole("region", { name: "Weekly plan proposal" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Accept weekly plan" })).toBeVisible();
});
