# How we used Kiro

RxGene is a pharmacogenomics safety check. A wrong rule can tell a patient a painkiller will
work when it won't, so we built it the way you'd build clinical software: **rules first, then
code, then independent checks that the code still matches the rules.** Kiro was the tool at
every step. Kiro wrote the rule engine, the CDS Hooks and summary APIs, the consult agent, the
tests and the adapter that connects the UI to real data. People and a lead agent wrote the specs,
reviewed every diff and owned the clinical data.

**Full disclosure: the desktop visual layer was prototyped in OpenAI Codex.** That's the
presentation component `web/src/ui/RxGeneUI.tsx` with its CSS and view-model types, the molecular
artwork in `web/public/art/`, `MoleculeStage`, and restyles of several components (PR #6, about
2,700 lines, 1:52–4:49 PM). It makes no clinical decisions. Kiro then wired it to the real engine,
API and consult agent (brief 20, `RxGeneConnected.tsx` + `mapAssessment.ts`).

## Our AI development strategy

| Role | Who | How |
|---|---|---|
| Clinical rules (EARS requirements), expected outputs, source checks | Ananya, our genetics teammate | Kiro spec mode, property-based tests, MCP |
| Engine, APIs, consult agent, tests, UI integration | Mithuna, plus the lead agent for brief 20 | **Kiro CLI**, headless, one scoped brief at a time |
| Desktop visual design and presentation layer | Hemnaath | OpenAI Codex (prototype), integrated by Kiro |
| Planning, writing briefs, reviewing every diff and deploy | A lead agent on each laptop | 23 briefs in [`.kiro/briefs/`](.kiro/briefs/) |

- **Each Kiro task got a written brief:** which files to touch, which requirements apply, which test cases must pass, and what "done" means. Briefs written after a live test quote the exact failure. For example, brief 16 quotes the measured 9.8 s, 1,238-token final call that was timing out.
- **Gate:** a diff was committed only after the expected-output test patients passed (26 hand-reviewed cases that Kiro can't edit; see the guard below). Every deploy was then smoke-tested against the live URL with `scripts/check_live.py`.
- **Models, chosen per task:** Opus 5.5 for most engine and UI work (10 commits), Sonnet 4.5 for clinical logic and the agent (3), and Haiku 4.5 for config and small fixes (3). The commit trailers record "Kiro (claude-…)".

## Kiro tools we used

**Kiro CLI**, in three modes:
- **Headless build runs.** `kiro-cli chat --no-interactive --trust-tools=read,write,glob,grep "<brief>"`. Kiro gets file tools only; tests and installs run outside it. The lead agent loops: run the brief, run the tests, send a `--resume` follow-up until everything is green.
- **Spec mode** (`--mode spec`) for requirements analysis and the consult-agent design and tasks.
- **A custom agent profile, `.kiro/agents/rxgene.json`** (`--agent rxgene`), which carries our safety hooks (see below).

**Not used:** the Kiro IDE, Web and Crew. Three people on separate laptops, coordinated through git, fit the CLI better. It also meant we hit CLI-version-specific behavior, which we document under hooks.

## Spec-driven development

**[`.kiro/specs/rxgene-engine/requirements.md`](.kiro/specs/rxgene-engine/requirements.md): 56 EARS requirements (R1–R56).**
- Our genetics teammate wrote them before any engine code existed.
- Example: *"WHEN a patient's genotype activity score is 0 AND any CYP2D6 inhibitor is present, THE SYSTEM SHALL still issue the drug-level alert … AND SHALL include an inhibitor note."*
- Every alert in the app shows the requirement IDs that produced it (R39), so a clinician can trace any warning back to a rule they can read.

**Requirements analysis ([`analysis.md`](.kiro/specs/rxgene-engine/analysis.md)).**
- Kiro in spec mode checked R1–R56 for conflicts, ambiguity and gaps.
- Result: **42 findings: 27 fixed, 3 partly fixed, 2 not a problem, 5 known limitations, 5 open.** Every finding has our decision beside it.
- The most important one was a real clinical conflict we had missed. **R18** (atomoxetine + a moderate inhibitor gives "not assessed") could hide the alert **R21** requires for a patient who is already a poor metabolizer by genotype.
- Resolution: R18 now defers to R21. We added fixture P26, and the engine was fixed (commit 7af163b).

**[`.kiro/specs/consult-agent/`](.kiro/specs/consult-agent/): the full requirements → design → tasks flow** for the pharmacist consult agent.
- Each of the 8 tasks lists the requirements it satisfies (R45–R56).
- Our genetics teammate ticked the tasks against the first agent commit: **5 done, 3 partly done**, each with the gap written down. Those gaps drove the next briefs.

**Compared with vibe coding.**
- Pharmacogenomics is mostly edge cases. Atomoxetine with a \*10 allele at activity score 1.0 uses a different dose row than the same score without one (R44). An ultrarapid metabolizer on a strong inhibitor needs a reduced-confidence flag (R20). Ad-hoc prompting loses those.
- With the spec, the fixtures and the property tests, every Kiro change ran against the same rules within the turn it was made.
- The spec also let a non-programmer own the science.

## Property-based testing

- Kiro generated **13 property tests (fast-check, 300 random cases each)** straight from the EARS requirements:
  - never output "safe" (R33)
  - an inhibitor never raises the activity score, and the strongest inhibitor wins (R10–R13)
  - the phenotype is monotonic in the activity score (R3–R6)
  - unknown or missing genotypes are never green (R7/R8)
  - a genotype poor metabolizer on any inhibitor still gets the alert and the R21 note
- **PBT found real bugs our 25 example cases had missed.** Its shrunk counterexample, `["*100/*100", ["abiraterone"], "atomoxetine"]` (a no-function allele plus a moderate inhibitor), returned GREY "Not assessed". That's the same R18/R21 conflict the requirements analysis flagged, found independently, without the test being pointed at it.
- It also exposed a **second gap**: for \*4/\*4 + fluoxetine + atomoxetine, the R21 "adds no further effect" note was missing.
- We left the property failing on purpose instead of weakening it. A fix brief (17) made both pass. All 128 tests pass now.

## Agent hooks

- **Clinical-data guard (PreToolUse, blocking).** `scripts/kiro-guard-clinical-data.mjs`: when Kiro tries to write to `data/cpic/`, `data/inhibitors.json` or `tests/fixtures/`, the hook exits with code 2. That blocks the write and tells Kiro: *"clinical data and expected outputs are owned by the genetics reviewer. Change the engine, not the data."*
  - **The AI that writes our code can't change the clinical facts or the answers it's tested against.**
  - Verified live: the write was blocked and `git diff --quiet data/` stayed clean.
- **Secrets guard (PreToolUse, blocking).** `scripts/kiro-guard-secrets.mjs` blocks reads of `.env*`, `.pem`, `.key` and `.p12`, while `.env.example` stays readable.
- **Stop hook:** every Kiro turn ends with the full test suite.
- **What we learned.** We first wrote standalone `.kiro/hooks/*.json` files and a `.kiroignore`. Live testing showed that our Kiro CLI (2.34) silently ignores both; they're CLI 3.x and IDE features. Before the fix, asking Kiro to read `web/.env` printed the API key in plain text.
  - We moved both guards into the CLI 2.x mechanism: hooks inside the custom agent profile (`.kiro/agents/rxgene.json`, run with `--agent rxgene`).
  - We kept the v3-style files for when the CLI is upgraded.
  - We'll rotate the exposed key after the event.

## Steering

[`.kiro/steering/`](.kiro/steering/) holds product, tech, structure, **clinical-rules** and git-workflow.

**The strategy that made the biggest difference:** `clinical-rules.md` states each rule *with its source* and forbids memory.
- Examples: "never type allele values from memory"; "phenoconversion is computed only for codeine and tramadol (CPIC opioids 2021)".
- LLMs tend to "know" CYP2D6 values, and some of that knowledge is outdated. CYP2D6\*41 is 0.25 in current CPIC data, not 0.5.
- In review we grepped every diff for hard-coded allele values or inhibitor lists. Kiro read them from the CPIC and FDA snapshots every time.

`tech.md` and `structure.md` kept generated code on the right side of a tricky boundary: the same engine runs in the browser and in Vercel functions.
- When production returned 500s because Node ES modules need explicit `.js` import extensions, Kiro fixed it from one brief (09).
- Every later server-side brief repeats that rule.

## MCP

- We added the reference **fetch MCP server** (`uvx mcp-server-fetch`) in [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json).
- Our genetics teammate used it from Kiro to re-verify the sources behind our claims, live:
  - The **openFDA count matched** (609 FAERS reports list both codeine and fluoxetine).
  - The two PubMed Central papers **could not be fetched through MCP**: a PMC bot check, a Europe PMC HTTP 500, and NCBI E-utilities disallowed by robots.txt, which the fetch server respects.
- We recorded those as "not verified via MCP" in [`docs/SCIENCE.md`](docs/SCIENCE.md) rather than working around the robots rules. Both were already verified by hand earlier in the day.

## Kiro Powers

We reviewed the Powers registry (Stripe, Supabase, Datadog, Figma, Neon, Postman, AWS Aurora and others). None covers pharmacogenomics or clinical decision support, so we didn't add one. Our closest need, live source lookups, is covered by MCP above.

## What Kiro built: the consult agent

The pharmacist consult agent shows the strategy end to end.
1. **The spec came first:** R45–R56 written by our genetics teammate, plus Kiro-generated design and tasks.
2. Kiro built the agent: tools, loop, validators, template fallback, UI and 8 tests.
3. **Live testing on the deployed preview** found three problems the mocked tests couldn't:
   - The final note needed 9.8 s and 1,238 tokens; we allowed 8 s and 1,200.
   - The model wrapped its JSON in code fences.
   - The model couldn't reliably copy opaque tool-call IDs into its citations.
4. Each became a measured brief (16, 18). The final design gives every tool result a short label (T1, T2, …) that the model cites, and a deterministic validator checks every citation against that run's trace.
5. In production, the agent now returns a cited, validated consult note (`source: "ai"`, ~11–14 s). If validation fails, the deterministic template is shown instead.

## Safety settings

- **Least-privilege tools:** CLI runs use `--trust-tools=read,write,glob,grep`, never `--trust-all-tools`.
- **Secrets:** the secrets guard (above) plus `.gitignore`. `.kiroignore` is kept for CLI 3.x and the IDE.

## By the numbers

| | |
|---|---|
| Kiro briefs | 23 |
| EARS requirements | 56 |
| Expected-output test patients | 26 |
| Automated tests | 128, including 13 property tests × 300 cases |
| Kiro requirements-analysis findings | 42 (27 fixed) |
| Real bugs found by PBT | 2 |
| Live smoke checks (`check_live.py`) | 8/8 on production |
