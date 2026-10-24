Model: claude-haiku-4.5. Run after brief 13 and before brief 12, or right after 12 if 12 is already running. About 15 min. This is Kiro configuration, not app code.

Goal: use Kiro's own safety features, so the pitch can say "the AI that writes our code can't read our keys or touch the clinical data."

## 1. .kiroignore (repo root)
Create `.kiroignore` (gitignore syntax; see https://kiro.dev/docs/kiroignore/):
```
.env
**/.env
**/.env.*
!**/.env.example
web/node_modules/
web/dist/
```
Check: ask Kiro to read web/.env. It must refuse or report that the file is blocked.

## 2. Hooks: check your version first
Run `kiro-cli --version` and read https://kiro.dev/docs/hooks/.
- CLI 3.x / V3 mode: hooks are standalone files `.kiro/hooks/<id>.json` with `{"version": "v1", "hooks": [...]}` and PascalCase triggers (`PreToolUse`, `PostFileSave`, `Stop`).
- CLI 2.x legacy: hooks live in the agent config's `hooks` field, with camelCase triggers (`preToolUse`, `stop`). Exit codes are the same.
Use whichever system your installed Kiro actually loads. If both work, prefer the v1 JSON files.

The existing `.kiro/hooks/engine-tests.kiro.hook` uses the older IDE format (`when.type: fileEdited`, `then.type: askAgent`). It may not fire in the CLI. Keep it for the IDE, and add the CLI-compatible hooks below.

### Hook A: protect the clinical data (PreToolUse, blocking)
- Matcher: built-in file-write tools only (`fs_write|str_replace`, or the `write` category). Anchor the regex so it doesn't match other tools.
- Action: a command running `node scripts/kiro-guard-clinical-data.mjs`. Put the script in the repo's top-level `scripts/` folder; plain Node, no dependencies.
  - Read the hook JSON from STDIN. Get the target path from `tool_input.path`; if it's missing, fall back to `tool_input.operations[0].path`. (The field name comes from a community test, so log what you actually receive.)
  - If the path is under `data/cpic/`, `data/inhibitors.json` or `tests/fixtures/`: write "Blocked: clinical data and expected outputs are owned by the genetics reviewer (Ananya). Change the engine, not the data." to STDERR and **exit 2**. Exit 2 blocks the tool and returns STDERR to the model; any other non-zero code only warns.
  - Otherwise, exit 0.
- Check: ask Kiro to append a comment to `data/inhibitors.json`. It must be blocked, and the file must be unchanged (`git diff --quiet data/`).

### Hook B: run the tests when Kiro finishes (Stop)
- Action: a command running `cd web && npx vitest run --reporter=dot`. Timeout 120 s.
- Check: finish a trivial turn. The test summary should appear.

### Hook C (optional, only if quick): PostFileSave on `web/src/engine/`
The same test command, as the CLI equivalent of the old IDE hook.

## 3. Docs
Add one line per hook to README's "How we built it with Kiro" table, keeping its style:
- **Kiroignore:** secrets are never readable by the agent.
- **PreToolUse guard:** the agent can't edit CPIC data or expected outputs.
- **Stop hook:** every Kiro turn ends with the test suite.

Run `npm test`. All tests must pass. Don't run git. List the files you changed and paste the evidence from each check (blocked write message, test summary).
