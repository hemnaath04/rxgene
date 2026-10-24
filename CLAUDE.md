@.kiro/steering/clinical-rules.md
@.kiro/steering/git-workflow.md

# RxGene: orchestration rules for Claude (the lead)

Claude leads the build. It plans, splits the work, reviews every result, and decides
what merges. The user will hand over the final plan file; build from that, not from
memory of earlier chats.

## Who does what

| Agent | Use it for | Don't use it for |
|---|---|---|
| **Kiro CLI** (`kiro-cli`) | **All product code.** The event requires vibe-coded projects to be built in Kiro, so the engine, server, and any app code go through Kiro. | Research |
| **Gemini** (`agy`, via the agent-terminals skill) | Web research and fact checks with citations: CPIC, FDA, stats, competitors | Writing code; final clinical calls |
| **Codex** | **Reserved for the user's frontend work.** Ask the user before using it, even for reviews. | Anything, unless the user says yes |
| **Claude** | Planning, task briefs for Kiro, reviewing Kiro's diffs against `tests/fixtures/`, checking clinical accuracy, docs, pitch, and git/PR operations | Writing product code directly (send it to Kiro) |

## Kiro model choice (credits are limited: 2,000 from the event code)

- `claude-sonnet-4.5` (1.30x): the rule engine and anything clinical-logic heavy, where
  correctness matters most.
- `auto` (1.00x): default for normal feature work.
- `claude-haiku-4.5` (0.40x): boilerplate, config, small fixes, tests from fixtures.
- `qwen3-coder-next` / `minimax-*` (0.05x to 0.25x): bulk mechanical edits only. Always
  review the output.
- Check `/usage` or the credit meter before any large task. Once credits run low, move
  everything to cheaper models.

## How to run Kiro headless

```bash
kiro-cli chat --no-interactive --model <model> --trust-tools=fs_read,fs_write "<brief>"
```

- Run each Kiro task in its own Terminal-panel tab so the user can watch it.
- A brief names: the files to touch, the fixture cases it must pass, the steering rules
  that apply, and what done looks like. Keep each brief to one task.
- Never use `--trust-all-tools`. Allow shell commands only per task, and only when needed.
- After each task: read the diff, run the fixture tests, and commit to `dev` only if
  they pass.

## Guardrails

- Clinical rules come only from `.kiro/steering/clinical-rules.md` and `data/cpic/`.
  Never invent a recommendation, an allele value, or an inhibitor class.
- Work on `dev`. `main` changes only by PR. Merge `dev` into `main` before 8 PM.
- Don't install large dependencies (the disk is about 96% full). Never commit `.env`.
- Submission deadline: SundAI by 8 PM ET, Sat Oct 24 2026. Aim to submit by 7:30.
