<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Chessboard appearance

Always use the existing wooden board and piece images from the `images/` folder for every chessboard in the app. The board image is `images/200.png`; the piece images are `wp.png`, `wn.png`, `wb.png`, `wr.png`, `wq.png`, `wk.png` and their black counterparts (`bp.png`, `bn.png`, `bb.png`, `br.png`, `bq.png`, `bk.png`). Their browser-served copies live in `public/images/`.

Reuse the shared `ReplayBoard` component and the `boardTheme` / `customPieces` definitions in `components/chess/board-theme.tsx` so all boards keep this appearance. Do not substitute default library pieces, plain-color boards, or a different theme unless the user explicitly requests it.
