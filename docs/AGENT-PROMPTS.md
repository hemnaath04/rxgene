# Agent prompts: Claude leads, Kiro codes

Each teammate runs **Claude Code** as the lead. Their Claude hands tasks to **Kiro CLI**,
runs the tests and commits. Kiro writes all the code, as the event requires. The rules
Claude follows are in [`CLAUDE.md`](../CLAUDE.md), which Claude Code loads automatically
from the repo.

Where things are:
- [Who does what](TEAM-SPLIT.md)
- [Build spec](../.plans/rxgene-build-spec.md)
- [Plan v3](PLAN-v3.md)
- [Kiro briefs](../.kiro/briefs/)

## One-time setup (each laptop, about 5 minutes)

```bash
git clone https://github.com/hemnaath04/rxgene && cd rxgene
git switch dev && git config core.hooksPath .githooks
curl -fsSL https://cli.kiro.dev/install | bash
kiro-cli login
kiro-cli doctor
```

Redeem your own Kiro event credit code in Kiro. Then start Claude Code **inside the
`rxgene` folder** and paste your prompt below.

---

## Mithuna: paste into Claude Code

```
I'm Mithuna. Follow CLAUDE.md exactly: you are the lead, and Kiro writes all the code through kiro-cli. Never edit web/ or api/ yourself.

My tasks are in docs/TEAM-SPLIT.md (the Mithuna section). Do them in this order:

0. Scaffold the app yourself (this is a template, not AI code): delete web/.gitkeep, run `npm create vite@latest web -- --template react-ts` (if it asks to install or start a dev server, say no), then `cd web && npm install && npm install -D vitest`. Show me the result.
1. Run Kiro with .kiro/briefs/mithuna-01-engine-and-tests.md, model claude-sonnet-4.5, tools read,write,glob,grep. Then run `cd web && npx vitest run`. Loop with --resume follow-ups until all 22 fixtures pass. Show me the failing cases each round.
2. Commit web/ to dev and push.
3. Run Kiro with .kiro/briefs/mithuna-02-plain-ui.md, model auto. Check that the Sarah, Marcus and Priya cases work (run `npm run dev` and tell me the URL). Commit and push.

Stop after each step and tell me: what changed, the test count, and Kiro credits used if you can see them. Deadline: everything in step 1 passes by 2:00 PM.
```

## Ananya: paste into Claude Code

```
I'm Ananya, the genetics teammate. Follow CLAUDE.md exactly: you are the lead, and Kiro writes the spec file through kiro-cli. My tasks are in docs/TEAM-SPLIT.md (the Ananya section).

1. Run Kiro with .kiro/briefs/ananya-01-requirements.md, model claude-sonnet-4.5, tools read,write,glob,grep. Show me the resulting .kiro/specs/rxgene-engine/requirements.md, and check every requirement against .kiro/steering/clinical-rules.md and .plans/rxgene-build-spec.md section 4. Flag anything that contradicts them. When I approve, commit only .kiro/specs/ to dev and push.
2. Walk me through tests/fixtures/expected_outputs.csv one row at a time: the genotype, the activity-score math, the inhibitor, the resulting phenotype and the CPIC text. I'll say "ok" or give a correction. For corrections, update data/ or scripts/make_expected.py (not app code), regenerate with `python3 scripts/make_expected.py tests/fixtures/expected_outputs`, and show me the diff. Finish by 1:45 PM. Then commit tests/fixtures/ (and data/ if it changed) and push.
3. Then help me with the pre-pitch verification checklist in docs/PLAN-v3.md: open the real CPIC sources and quote the exact lines. Draft the science part of the pitch into docs/SCIENCE.md.
```

## Hemnaath: paste into Codex (design only, due 1:30)

Use the prompt in [`docs/CODEX-DESIGN-PROMPT.txt`](CODEX-DESIGN-PROMPT.txt). Save the
answer as `docs/DESIGN.md` on `dev`. Mithuna's Claude will then send Kiro a brief to
apply it.

---

## Later briefs

Claude (Hemnaath's lead session) adds new briefs to `.kiro/briefs/` as each gate passes:
the design, the gauge and drawer, `/api/summary`, and CDS Hooks. Each teammate's Claude
pulls `dev` and runs the next numbered brief for its owner.
