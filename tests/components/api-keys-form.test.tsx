import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiKeysForm } from "@/components/settings/api-keys-form";
import type { CoachingSettings } from "@/lib/coaching/providers";
const settings: CoachingSettings = { provider: "ANTHROPIC", model: "claude-haiku-4-5", persona: "BALANCED", available: { ANTHROPIC: true, OPENAI: true, DEEPSEEK: false },
  personalKeys: { OPENAI: { lastFour: "1234", readable: true } } };
const item = (label: string) => screen.getByText(label).closest("li")!;
afterEach(() => vi.unstubAllGlobals());
it("shows which key each provider uses", () => {
  render(<ApiKeysForm settings={settings} />);
  expect(item("Anthropic (Claude)")).toHaveTextContent("Using the shared server key");
  expect(item("OpenAI (GPT)")).toHaveTextContent("Using your key ending in 1234");
  expect(item("DeepSeek")).toHaveTextContent("Unavailable — add your key");
  expect(within(item("OpenAI (GPT)")).getByRole("button", { name: "Remove key" })).toBeEnabled();
  expect(within(item("DeepSeek")).queryByRole("button", { name: "Remove key" })).not.toBeInTheDocument();
  expect(within(item("DeepSeek")).getByRole("button", { name: "Save key" })).toBeDisabled();
});
it("saves a pasted key, clears the field, and shows the new status", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ ...settings, available: { ...settings.available, DEEPSEEK: true }, personalKeys: { ...settings.personalKeys, DEEPSEEK: { lastFour: "9876", readable: true } } }));
  vi.stubGlobal("fetch", fetch);
  render(<ApiKeysForm settings={settings} />);
  const field = screen.getByLabelText("DeepSeek API key");
  expect(field).toHaveAttribute("type", "password");
  fireEvent.change(field, { target: { value: " sk-deepseek-fixture-key-00009876 " } });
  fireEvent.click(within(item("DeepSeek")).getByRole("button", { name: "Save key" }));
  expect(await screen.findByRole("status")).toHaveTextContent("DeepSeek key saved.");
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/settings/keys/DEEPSEEK", expect.objectContaining({ method: "PUT", body: '{"apiKey":"sk-deepseek-fixture-key-00009876"}' }));
  expect(field).toHaveValue("");
  expect(item("DeepSeek")).toHaveTextContent("Using your key ending in 9876");
});
it("removes a key and falls back to the shared server key", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ ...settings, personalKeys: {} }));
  vi.stubGlobal("fetch", fetch);
  render(<ApiKeysForm settings={settings} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove key" }));
  expect(await screen.findByRole("status")).toHaveTextContent("OpenAI (GPT) key removed.");
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/settings/keys/OPENAI", { method: "DELETE" });
  expect(item("OpenAI (GPT)")).toHaveTextContent("Using the shared server key");
});
it("keeps the typed key and the saved status when saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "Could not save your API key." } }, { status: 503 })));
  render(<ApiKeysForm settings={settings} />);
  const field = screen.getByLabelText("DeepSeek API key");
  fireEvent.change(field, { target: { value: "sk-deepseek-fixture-key-00009876" } });
  fireEvent.click(within(item("DeepSeek")).getByRole("button", { name: "Save key" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Could not save");
  expect(field).toHaveValue("sk-deepseek-fixture-key-00009876");
  expect(item("DeepSeek")).toHaveTextContent("Unavailable");
});
it("explains unreadable keys and hides key entry when the server cannot store keys", () => {
  const { unmount } = render(<ApiKeysForm settings={{ ...settings, personalKeys: { OPENAI: { lastFour: "1234", readable: false } } }} />);
  expect(item("OpenAI (GPT)")).toHaveTextContent("can no longer be read. Enter it again; until then the shared server key is used.");
  unmount();
  render(<ApiKeysForm settings={{ ...settings, personalKeys: null }} />);
  expect(screen.getByText(/Personal keys are turned off/)).toHaveTextContent("API_KEY_ENCRYPTION_SECRET");
  expect(item("DeepSeek")).toHaveTextContent("set DEEPSEEK_API_KEY in the server environment");
  expect(screen.queryByLabelText("DeepSeek API key")).not.toBeInTheDocument();
});
