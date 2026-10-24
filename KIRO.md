# How we used Kiro

> Draft. Sections marked **[TO FILL]** are completed when the work lands. The final version
> must contain no placeholders.

RxGene is a pharmacogenomics safety check. A wrong rule can tell a patient that a painkiller
will work when it won't, so we built it the way you'd build clinical software: **rules first,
then code, then checks that the code still matches the rules.** Kiro was the tool for every
step. Every line of app code in `web/` was written by Kiro; humans and a lead agent wrote the
specs, reviewed the diffs and owned the clinical data.

## Our AI development strategy

| Role | Who | Tool |
|---|---|---|
| Clinical rules (EARS requirements), test-patient review, source checks | Ananya, our genetics teammate | Kiro (spec mode) |
| All app code: engine, API, UI | Mithuna | **Kiro CLI**, headless, one scoped brief at a time |
| Planning, writing briefs, reviewing every diff against the rules | A lead agent on each laptop | Briefs it hands to Kiro, saved in [`.kiro/briefs/`](.kiro/briefs/) |

- Each Kiro task got a written brief: which files to touch, which requirements apply, which test cases must pass, and what "done" means. There are 20 briefs in [`.kiro/briefs/`](.kiro/briefs/).
- A diff was committed only after the 25 expected-output test patients passed. They're a hand-reviewed fixture file Kiro is not allowed to edit.
- Model choice per task: Claude Sonnet for clinical logic, Haiku for small config and fixes, and Opus 5.5 for most engine and UI work (the commit trailers show "Kiro (claude-opus-5.5)").

## Kiro tools we used

- **Kiro CLI:** most of the build. `kiro-cli chat --no-interactive --trust-tools=read,write,glob,grep "<brief>"`. Kiro gets read and write access only; tests and installs run outside Kiro, so a brief can't run arbitrary shell commands. Headless runs let the lead agent loop: run the brief, run the tests, send a follow-up with `--resume` until green.
- **Kiro spec mode:** requirements analysis and the consult-agent design and tasks (details below).
- **Kiro IDE:** **[TO FILL: property-based testing, Ananya]**
- **Kiro Web / Crew:** not used. A one-day build with three people on separate laptops fit the CLI-plus-git workflow better.

## Spec-driven development

**[`.kiro/specs/rxgene-engine/requirements.md`](.kiro/specs/rxgene-engine/requirements.md): 56 EARS requirements (R1–R56).**
- Our genetics teammate wrote them before any engine code existed.
- Example: *"WHEN a patient's genotype activity score is 0 AND any CYP2D6 inhibitor is present, THE SYSTEM SHALL still issue the drug-level alert … AND SHALL include an inhibitor note."*
- Every alert in the app shows the requirement IDs that produced it (R39), so a clinician can trace any warning back to a rule they can read.

**Analyze Requirements ([`analysis.md`](.kiro/specs/rxgene-engine/analysis.md)).**
- Kiro checked R1–R56 for conflicts, ambiguity and gaps, and found **42 findings: 27 fixed, 3 partly fixed, 2 not a problem, 5 known limitations, 5 open.**
- One was a real clinical conflict we had missed. R18 (atomoxetine + moderate inhibitor gives "not assessed") could hide the alert R21 requires for a patient who is already a poor metabolizer. **[TO FILL: how it was resolved]**
- Earlier, reviewing by hand, we had found two contradictions (R23 vs R43, R31 vs R33). Kiro's check found the class of problem we weren't looking for.

**[`.kiro/specs/consult-agent/`](.kiro/specs/consult-agent/): the full requirements → design → tasks flow** for the pharmacist consult agent. Each of the 8 tasks lists the requirements it satisfies (R45–R56). **[TO FILL: tasks marked done with commit hashes]**

**Compared with vibe coding.**
- Pharmacogenomics has many edge cases. A dose rule with a \*10 allele (R44) differs from the same activity score without one; an ultrarapid metabolizer on a strong inhibitor needs a confidence flag (R20). Prompting ad hoc, those get lost.
- With the spec plus fixtures, every Kiro change ran against the same 25 patients, and regressions showed up within the turn they were made in.
- The spec also made the science reviewable by a non-coder.

## Agent hooks

- **[`engine-tests.kiro.hook`](.kiro/hooks/engine-tests.kiro.hook):** saving an engine file runs the test suite (IDE).
- **[TO FILL, brief 14]**
  - **PreToolUse guard:** the agent cannot edit CPIC data, the FDA inhibitor table or the expected outputs. Exit code 2 blocks the write and tells Kiro why. Evidence: …
  - **Stop hook:** every Kiro turn ends with the full test suite.
- Why it matters: the AI that writes our code can't silently change the clinical facts it's coding against.

## Steering

[`.kiro/steering/`](.kiro/steering/) holds product, tech, structure, **clinical-rules** and git-workflow.

**The strategy that made the biggest difference:** `clinical-rules.md` states each rule *with its source* and bans memory.
- Rules like "never type allele values from memory" and "phenoconversion is computed only for codeine and tramadol (CPIC opioids 2021)."
- LLMs tend to "know" CYP2D6 values, and some of that knowledge is outdated. CYP2D6\*41 is 0.25 in current CPIC data, not 0.5.
- In review, we grep every diff for hard-coded allele values. Kiro read them from the CPIC snapshot every time.

`tech.md` and `structure.md` kept generated code on the right side of a tricky boundary: the same engine runs in the browser and in Vercel functions. When production returned 500s because Node ES modules need explicit `.js` import extensions, Kiro fixed it from one brief (09), and every later server-side brief repeats the rule.

## MCP

**[TO FILL: Ananya]** We configured [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json) with a fetch server and used it to re-verify, live, the sources behind our key claims (the CPIC phenoconversion rule, the 20–30% phenoconversion statistic, and openFDA report counts). Results: …

## Property-based testing

**[TO FILL: Ananya, Kiro IDE]** Properties extracted from the EARS requirements, for example:
- never output "safe" (R33)
- an inhibitor never raises the activity score (R10–R13)
- unknown genotypes are never green (R7/R8)
- the consult agent never changes an alert (R54)

Issues PBT caught that our 25 example cases didn't: …

## Kiro Powers

We reviewed the Powers registry (Stripe, Supabase, Datadog, Figma, Neon, Postman, AWS Aurora and others). None covers pharmacogenomics or clinical decision support, so we didn't force one in. The closest need, live source lookups, is covered by MCP above.

## Safety settings

- **`.kiroignore`:** **[TO FILL, brief 14]** blocks every `.env`, so the agent never reads our API keys.
- **Least-privilege tools:** CLI runs use `--trust-tools=read,write,glob,grep`, never `--trust-all-tools`.

## By the numbers

**[TO FILL at freeze]** Briefs: 20 · requirements: 56 · test patients: 25 · unit tests: … · property tests: … · Kiro analysis findings: 42.
