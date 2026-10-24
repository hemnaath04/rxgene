# Tech

- **Frontend:** React + Vite + TypeScript in `web/`.
- **Backend:** a small Node (TypeScript) endpoint in `server/`, used only for LLM calls.
  The API key lives in `.env` and is never sent to the browser.
- **Rule engine:** pure TypeScript functions with no network calls, in `web/src/engine/`.
  It reads the JSON snapshots in `data/`.
- **No database.** **No live CPIC API calls during the demo.** Use the `data/cpic/`
  snapshots.
- **Tests:** every case in `tests/fixtures/expected_outputs.json` must pass before the
  feature freeze.
- If the LLM call fails, fall back to templated explanations. The demo must work offline
  except for extraction.
- Keep dependencies minimal. Disk space is limited.
