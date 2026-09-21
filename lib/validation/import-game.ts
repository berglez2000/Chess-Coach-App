import { z } from "zod";

export const MAX_PGN_LENGTH = 100_000;

export const importGameSchema = z.object({
  userColor: z.enum(["WHITE", "BLACK"], { error: "Select White or Black." }),
  pgn: z.string({ error: "Paste a PGN as text." })
    .max(MAX_PGN_LENGTH, "PGN is too long. Import a single game under 100,000 characters.")
    .refine((value) => value.trim().length > 0, "Paste a PGN containing at least one move."),
});
