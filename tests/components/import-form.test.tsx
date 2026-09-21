import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportForm } from "@/components/games/import-form";
import { parsePgn } from "@/lib/pgn/parse";
import type { ImportState } from "@/types/import";

afterEach(() => vi.unstubAllGlobals());

function fill(color = "WHITE", pgn = "1. e4 e5 *") {
  fireEvent.change(screen.getByLabelText("Your color"), { target: { value: color } });
  fireEvent.change(screen.getByLabelText("Game PGN"), { target: { value: pgn } });
}
function submit() {
  fireEvent.submit(screen.getByRole("button").closest("form")!);
}

describe("Import form", () => {
  it("posts to the persistence API and retries a failed save with retained input", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: { code: "IMPORT_FAILED", message: "Could not save your game. Please try again." } }, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ gameId: "saved-game", status: "PENDING", userColor: "BLACK", game: parsePgn("1. e4 e5 *") }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ImportForm />);
    fill("BLACK");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
    expect(screen.getByLabelText("Your color")).toHaveValue("BLACK");
    expect(screen.getByLabelText("Game PGN")).toHaveValue("1. e4 e5 *");
    submit();
    expect(await screen.findByRole("status", { name: "Game imported" })).toHaveTextContent("Your game is saved.");
    expect(await screen.findByRole("heading", { name: "Game review" })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/games", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userColor: "BLACK", pgn: "1. e4 e5 *" }),
    });
  });
  it("has three required controls and checks whitespace before a server call", async () => {
    const action = vi.fn();
    render(<ImportForm importAction={action} />);
    expect(screen.getByRole("combobox")).toBeRequired();
    expect(screen.getByRole("textbox")).toBeRequired();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fill("WHITE", "   ");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the highlighted fields.");
    expect(action).not.toHaveBeenCalled();
  });

  it.each(["WHITE", "BLACK"])("submits selected %s color and shows the parsed result", async (color) => {
    const action = vi.fn().mockResolvedValue({ status: "success", gameId: "saved-game", userColor: color, game: parsePgn("1. e4 e5 *") });
    render(<ImportForm importAction={action} />);
    fill(color);
    submit();
    expect(await screen.findByText("Game imported")).toBeVisible();
    const data = action.mock.calls[0][0] as FormData;
    expect(data.get("userColor")).toBe(color);
    expect(data.get("pgn")).toBe("1. e4 e5 *");
    expect(screen.getByRole("status", { name: "Game imported" })).toHaveTextContent("2 half-moves");
    // Changing input must not leave the old result presented as current.
    fireEvent.change(screen.getByLabelText("Game PGN"), { target: { value: "1. d4 *" } });
    expect(screen.queryByText("Game imported")).not.toBeInTheDocument();
  });

  it("shows replay when browser submission normalizes multiline PGN to CRLF", async () => {
    const pgn = '[White "Aljaz"]\n\n1. e4 e5 *\n';
    const submitted = pgn.replaceAll("\n", "\r\n");
    render(<ImportForm importAction={vi.fn().mockResolvedValue({
      status: "success", gameId: "saved-game", userColor: "WHITE", game: parsePgn(submitted),
    })} />);
    fill("WHITE", pgn);
    submit();
    expect(await screen.findByRole("heading", { name: "Game review" })).toBeVisible();
    expect(screen.getByLabelText("Game PGN")).toHaveValue(pgn);
  });

  it("disables repeat submission while pending and retains inputs on validation failure", async () => {
    let resolve!: (value: ImportState) => void;
    const action = vi.fn(() => new Promise<ImportState>((done) => { resolve = done; }));
    render(<ImportForm importAction={action} />);
    fill("BLACK", "1. e4 e5 2. Bh6 *");
    submit();
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeDisabled();
    await act(async () => resolve({ status: "error", message: "The PGN could not be imported.", fields: { pgn: "Illegal move." } }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be imported");
    expect(screen.getByLabelText("Your color")).toHaveValue("BLACK");
    expect(screen.getByLabelText("Game PGN")).toHaveValue("1. e4 e5 2. Bh6 *");
    expect(screen.getByLabelText("Game PGN")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("retains input and offers retry after a transport failure", async () => {
    render(<ImportForm importAction={vi.fn().mockRejectedValue(new Error("private transport error"))} />);
    fill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server");
    expect(screen.getByLabelText("Game PGN")).toHaveValue("1. e4 e5 *");
    expect(screen.queryByText("private transport error")).not.toBeInTheDocument();
  });
});
