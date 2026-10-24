Model: claude-sonnet-4.5. Owner: Ananya. About 25 min, target 3:45 PM. This shows judges Kiro's full spec workflow and its built-in requirement check.

## 1. Analyze Requirements (about 10 min)
Kiro's spec feature includes "Analyze Requirements", which flags inconsistencies, ambiguities and gaps (https://kiro.dev/docs/specs/). In Kiro CLI it's under the `/spec` slash command (`/spec` lists specs, creates them, runs tasks and analyzes requirements); in the IDE, it's in the spec panel.

Run it on `.kiro/specs/rxgene-engine/requirements.md` (R1–R56).
- Save Kiro's findings, verbatim, to `.kiro/specs/rxgene-engine/analysis.md`. Under each finding, add your decision: "fixed (Rxx changed)", "not a problem because …", or "known limitation (README)".
- Fix real problems in requirements.md. Keep R numbers stable: don't renumber; mark a removed requirement "Removed".
- If a fix changes engine behavior, add or change a row in tests/fixtures (regenerate with `python3 scripts/make_expected.py tests/fixtures/expected_outputs`) and tell Hemnaath, so Mithuna gets a brief.
- Pitch context: we found two contradictions by hand this morning (R23 vs R43, R31 vs R33). This step shows the check is now built into the workflow.

## 2. Consult-agent spec: design + tasks (about 15 min)
Create `.kiro/specs/consult-agent/`:
- `requirements.md`: a short header ("Consult agent requirements live in rxgene-engine/requirements.md, R45–R56."), then a copy of R45–R56. Keep the numbers.
- Ask Kiro to generate **design.md** from those requirements plus `.kiro/briefs/mithuna-12-consult-agent.md`. It should cover: the tools (get_patient, check_drug, list_inhibitors, get_evidence), the agent loop, validation, the template fallback, the /api/consult endpoint, the ConsultSheet UI, and a small diagram.
- Ask Kiro to generate **tasks.md**: about 8 tasks, each listing the R-numbers it satisfies.
- **Don't run the tasks.** Mithuna is building the agent from brief 12. When her commit lands, mark each task complete and note the commit hash beside it.

Commit only `.kiro/specs/` (plus `tests/fixtures/`, `data/` and `scripts/make_expected.py` if step 1 changed them) to dev. Run `git pull --rebase origin dev` first, then push.
