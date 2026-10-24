@.kiro/steering/clinical-rules.md
@.kiro/steering/git-workflow.md

# RxGene: rules for Claude (every teammate's machine)

On each teammate's laptop, **Claude is the lead and Kiro writes the code.** Claude reads
the plan, hands Kiro one task at a time, runs the tests, reviews the diff, and commits.
The event requires every line of AI-generated code to come from **Kiro**, so Claude
never writes product code itself.

Source of truth, in this order:
1. `.plans/rxgene-build-spec.md` (what we build) and `.plans/rxgene-architecture-spec.md` (how: stack, layout, scaffold). On structure, the architecture spec wins.
2. `docs/TEAM-SPLIT.md` (who does what, and the day's gates)
3. `docs/PLAN-v3.md` (strategy, pitch)
4. `.kiro/briefs/` (ready-made Kiro task briefs, numbered per owner)

## First, ask who you're working for

Ask the user: "Are you Mithuna, Ananya or Hemnaath?" Then work only on that person's
section of `docs/TEAM-SPLIT.md` and their briefs in `.kiro/briefs/`.

| Owner | Owns these paths | Must not edit |
|---|---|---|
| Mithuna | `web/` (including `web/api/`) | `.kiro/specs/`, `tests/fixtures/` |
| Ananya | `.kiro/specs/`, `data/` (review), `tests/fixtures/` (review), `docs/SCIENCE.md` | `web/` |
| Hemnaath | `docs/DESIGN.md`, slides, submission | `web/` |

## What Claude may and may not do

- **May:**
  - Read anything.
  - Write Kiro briefs and docs.
  - Run commands: `npm` installs and scaffolding, `npx vitest run`,
    `python3 scripts/make_expected.py`, git.
  - Review diffs, then commit and push.
- **Scaffolding:** follow `.plans/rxgene-architecture-spec.md` section 7. It replaces "step 0" in any starter prompt.
- **Must not** create or edit code in `web/` with its own Write/Edit tools.
  Every code change goes through Kiro. If Kiro gets something wrong, send it a follow-up
  brief; don't patch the code yourself.

## How to drive Kiro (headless)

One-time setup per machine:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
kiro-cli login
kiro-cli doctor
```

The user signs in once and redeems their own event credit code in Kiro.

To run a task:

```bash
kiro-cli chat --no-interactive --trust-workspace --model <model> \
  --trust-tools=read,write,glob,grep "$(cat .kiro/briefs/<brief>.md)"
```

- Add `,shell` to `--trust-tools` **only** when the brief needs Kiro to run commands
  itself. By default, Claude runs the tests and installs. Never use `--trust-all-tools`.
- To follow up in the same Kiro conversation (it keeps its context):
  `kiro-cli chat --no-interactive --resume --model <model> --trust-tools=read,write,glob,grep "<follow-up>"`.
- Kiro can run for several minutes, so run it in the background and wait for it to finish.

**Model per task** (credits are limited; check usage at every gate):
- `claude-sonnet-4.5` for the engine and clinical logic.
- `auto` for UI and features.
- `claude-haiku-4.5` for boilerplate, config and small fixes.

## The loop for every task

1. `git switch dev && git pull --rebase origin dev`
2. Read the brief, and check it against the spec. If they conflict, the spec wins; ask the
   user if you're unsure.
3. Run Kiro with the brief.
4. Run the tests: `cd web && npx vitest run`. All 22 fixtures must pass before you commit
   any engine change.
5. Review the diff against `clinical-rules.md`. Check for:
   - hardcoded allele values or recommendation text
   - the word "safe"
   - the AI deciding whether an alert appears
6. If something fails, send Kiro a short, specific follow-up with `--resume`. Repeat.
7. Commit only your own paths:
   `git add <your paths> && git commit -m "..." && git pull --rebase origin dev && git push origin dev`.
8. Tell the user what changed, the test count, and what's next.

## Guardrails

- Clinical rules come only from `.kiro/steering/clinical-rules.md` and `data/`. Never
  invent a recommendation, an allele value or an inhibitor class.
- `main` changes only through a PR from `dev`. Hemnaath merges it before 7:15 PM.
- Never commit `.env` or API keys. LLM settings: `LLM_BASE_URL`, `LLM_API_KEY`,
  `LLM_MODEL` in `.env` (never with a `VITE_` prefix).
- If Ananya disagrees with a fixture row, her answer wins. Regenerate with
  `python3 scripts/make_expected.py tests/fixtures/expected_outputs`.
- Deadlines: test gate 2:00 PM, feature freeze 5:30 PM, submit by 7:30 PM ET.
