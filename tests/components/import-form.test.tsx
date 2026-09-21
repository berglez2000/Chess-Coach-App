import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportForm } from "@/components/games/import-form";
import { parsePgn } from "@/lib/pgn/parse";
import type { ImportState } from "@/types/import";

function fill(color = "WHITE", pgn = "1. e4 e5 *") {
  fireEvent.change(screen.getByLabelText("Your color"), { target: { value: color } });
  fireEvent.change(screen.getByLabelText("Game PGN"), { target: { value: pgn } });
}
function submit() {
  fireEvent.submit(screen.getByRole("button").closest("form")!);
}

describe("Import form", () => {
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
    const action = vi.fn().mockResolvedValue({ status: "success", userColor: color, game: parsePgn("1. e4 e5 *") });
    render(<ImportForm importAction={action} />);
    fill(color);
    submit();
    expect(await screen.findByText("Game imported")).toBeVisible();
    const data = action.mock.calls[0][0] as FormData;
    expect(data.get("userColor")).toBe(color);
    expect(data.get("pgn")).toBe("1. e4 e5 *");
    expect(screen.getByRole("status")).toHaveTextContent("2 half-moves");
    // Changing input must not leave the old result presented as current.
    fireEvent.change(screen.getByLabelText("Game PGN"), { target: { value: "1. d4 *" } });
    expect(screen.queryByText("Game imported")).not.toBeInTheDocument();
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
