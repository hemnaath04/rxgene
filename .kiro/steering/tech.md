# Tech (full detail: .plans/rxgene-architecture-spec.md)

- One package in `web/`, which is also the Vercel Root Directory. Vite + React + TypeScript (versions pinned by create-vite; don't upgrade), Tailwind v4 via `@tailwindcss/vite`, shadcn/ui components in `src/components/ui/`, Motion (`motion/react`) only for the gauge and card transitions, lucide-react icons.
- Rule engine: pure TS in `web/src/engine/`, with no fetch calls and no React. The browser and the serverless functions both import it.
- Data: import JSON from `@/data/...`. These files are copied from repo-root `data/` by `npm run sync-data`, so never edit the copies.
- Serverless functions in `web/api/`, written as Web-standard handlers (`export async function POST(request: Request)`) on the Node runtime. No Edge runtime. Shared helpers go in `web/api/_lib/`.
- LLM: plain `fetch` to the OpenAI-compatible `${LLM_BASE_URL}/chat/completions`. The env vars are server-only; never use a `VITE_` prefix.
- App default is EHR mode: the UI calls our own CDS Hooks endpoint, and falls back to the local engine on an error or after 3 s.
- Tests: Vitest (`npm test`). The 22 fixtures in `../tests/fixtures/expected_outputs.json` must pass. There are also handler tests. No Playwright.
- No database. No live CPIC API calls. Keep dependencies minimal, because the disk is nearly full.
