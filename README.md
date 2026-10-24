# RxGene

**Your genes don't change. Your prescriptions do.**

RxGene is a pre-prescription pharmacogenomics (PGx) check. When a clinician adds a
medication, it re-checks the patient's existing genetic test results against
[CPIC](https://cpicpgx.org) guidelines **and** the patient's current medications. That way
it catches **phenoconversion**: a patient who is genetically a normal CYP2D6 metabolizer
but takes fluoxetine behaves like a poor metabolizer, so codeine won't relieve their pain.

> Built at Hackachusetts 2026 (Biotech & Healthcare track). Synthetic data only.
> RxGene supports clinicians and pharmacists. It does not replace them.

**Submission docs:** [How we used Kiro](KIRO.md) · [Project description](docs/SUBMISSION.md) · **Team docs:** [Agent prompts](docs/AGENT-PROMPTS.md) · [Who does what](docs/TEAM-SPLIT.md) · [Build spec](.plans/rxgene-build-spec.md) · [Plan v3](docs/PLAN-v3.md) · [Clinical rules](.kiro/steering/clinical-rules.md)

## The problem

- 99.5% of 487,409 UK Biobank participants carry at least one variant that may change
  their response to a drug
  ([McInnes 2020](https://www.ukbiobank.ac.uk/publications/pharmacogenetics-at-scale-an-analysis-of-the-uk-biobank/)).
- In settings where CYP2D6 genotype is used, about 20–30% of patients also take a drug
  that causes phenoconversion. Most clinicians have limited knowledge of these drugs
  ([Cicali 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8404400/)).
- When an LLM was given CPIC guidance alone, it couldn't account for phenoconversion
  ([Sciforum preprint](https://sciforum.net/paper/24984)). That's why RxGene uses rules, not
  a chatbot.

## How it works

```
PGx lab report (PDF/text) ──► LLM extraction ──► pharmacist confirms genotypes
                                                        │
current meds + new drug ────────────────────────────────┤
                                                        ▼
                         deterministic rule engine (CPIC snapshot)
                         genotype → activity score → inhibitor adjustment → phenotype
                                                        │
                                                        ▼
                  alert (RED / YELLOW / GREEN / GREY) + evidence drawer (guideline, strength, date)
                                                        │
                                                        ▼
                     clinician report + plain-language patient summary (LLM explains, never decides)
```

**AI proposes, deterministic code decides.**

## Scope

| Gene | Drug | Phenoconversion |
|---|---|---|
| CYP2D6 | codeine, tramadol | Computed (rule stated in CPIC opioids 2021) |
| CYP2D6 | atomoxetine | Strong inhibitor: poor-metabolizer recommendation. Moderate inhibitor: pharmacist review |
| CYP2C19 | clopidogrel (ACS/PCI) | Genotype only; omeprazole shown as a label-level note |

Next steps (on slides, not in code): DPYD + capecitabine/5-FU, FHIR/CDS Hooks EHR
integration.

## How we built it with Kiro

Every line of app code in `web/` was written by **Kiro**, as the event requires. Our
workflow made the safety rules reviewable *before* any code existed:

| Kiro feature | How we used it | Where |
|---|---|---|
| **Steering** | Product, tech stack, structure, clinical rules and git workflow, loaded into every Kiro session. Each clinical rule cites its source (CPIC opioids 2021, CPIC 2023, FDA inhibitor table). | [`.kiro/steering/`](.kiro/steering/) |
| **Spec (requirements)** | 55 active numbered EARS requirements (R1–R56; R23 was removed in science review), written by our genetics teammate before the engine was built. Every alert shows the requirement IDs that triggered it. | [`.kiro/specs/rxgene-engine/requirements.md`](.kiro/specs/rxgene-engine/requirements.md) |
| **Agent hook** | Saving any engine file runs the expected-output test suite, so a broken rule shows up at once. | [`.kiro/hooks/engine-tests.kiro.hook`](.kiro/hooks/engine-tests.kiro.hook) |
| **Secrets guard** | The agent cannot read `.env`, `.pem`, `.key` or `.p12` files; confirmed live (it refused to read `web/.env`). Our installed Kiro CLI is 2.x, which predates `.kiroignore` (CLI V3/IDE only), so this runs as a `preToolUse`/`read` hook instead. | [`.kiro/agents/rxgene.json`](.kiro/agents/rxgene.json), [`scripts/kiro-guard-secrets.mjs`](scripts/kiro-guard-secrets.mjs) |
| **PreToolUse guard** | The agent cannot edit CPIC data, inhibitor rules, or expected outputs—these belong to the genetics reviewer. Confirmed live with the exact block message. | [`.kiro/agents/rxgene.json`](.kiro/agents/rxgene.json), [`scripts/kiro-guard-clinical-data.mjs`](scripts/kiro-guard-clinical-data.mjs) |
| **Stop hook** | Every Kiro turn ends with the test suite (`npx vitest run`), so a broken rule shows up immediately. | [`.kiro/agents/rxgene.json`](.kiro/agents/rxgene.json) |
| **Task briefs** | Each feature was handed to Kiro as one scoped brief (files to touch, cases to pass, rules that apply), then reviewed against the fixtures before commit. | [`.kiro/briefs/`](.kiro/briefs/) |

The design rule throughout: **AI proposes, deterministic code decides.** The rule engine is
plain TypeScript with no model calls. An LLM is used only to rewrite the engine's result
in plain language. That text is validated (same drug, same action, every dose kept, no new
drugs or numbers, never the word "safe"), and if it fails, a fixed template is shown instead.

## Repo layout

```
.kiro/steering/   product, tech, structure, and clinical rules (Kiro loads these every session)
web/              React + Vite + TS app (scaffold in Kiro); engine goes in web/src/engine/
server/           small Node endpoint for LLM extraction/explanation
data/cpic/        CPIC API snapshots: allele values, recommendations, guideline links
data/             inhibitors.json, synthetic-reports/
tests/fixtures/   expected outputs for 25 synthetic test patients
scripts/          fetch_cpic.py (refresh snapshots), make_expected.py (regenerate fixtures)
docs/             TEAM-SPLIT (who does what), PLAN-v3 (strategy + pitch), verified answers
.plans/           build spec (source of truth for what we build)
```

## Try it

**Live demo (no login):** https://rxgene.vercel.app

- Sarah, the main case (fluoxetine + codeine → "Avoid codeine"): https://rxgene.vercel.app/?patient=sarah&add=codeine
- Marcus, already a poor metabolizer (one precise alert, not two): https://rxgene.vercel.app/?patient=marcus&add=codeine
- Lena, the reverse case (adding fluoxetine re-alerts the codeine she already takes): https://rxgene.vercel.app/?patient=lena&add=fluoxetine
- The CDS Hooks service an EHR calls: https://rxgene.vercel.app/cds-services

All patients are synthetic.

## Run it locally

Requirements: Node.js 22 or later, npm, and Python 3 (only for the data scripts).

```bash
git clone https://github.com/hemnaath04/rxgene && cd rxgene/web
npm ci
npm run dev        # UI + API on http://localhost:5173 (copies ../data into src/data first)
```

- **Tests:** `npm test` (expected-output fixtures, edge cases, API handlers).
- **Production build:** `npm run build`.
- **AI patient summary (optional):** `cp .env.example .env` in `web/` and set `LLM_BASE_URL`, `LLM_API_KEY` (any OpenAI-compatible endpoint) and `LLM_MODEL`. Without them the app still works and shows the fixed template.
- **Check a deployment end to end:** `python3 scripts/check_live.py https://rxgene.vercel.app` from the repo root.
- **Refresh the data snapshots:** `python3 scripts/fetch_cpic.py` and `python3 scripts/fetch_openfda.py`.

How Kiro was used to build it: [KIRO.md](KIRO.md).

## Git workflow

- Push straight to `dev`. `main` only changes through a PR from `dev`.
- After cloning, run `git config core.hooksPath .githooks` once. The hook blocks direct pushes to `main`.
- Merge `dev` into `main` (via PR) before submitting. Judges read `main`.

## Test patients

25 synthetic cases cover genotype-only alerts, phenoconversion (strong, moderate and weak
inhibitors, plus the reverse case where adding an inhibitor re-alerts a drug already on the list), alert de-escalation (a patient who is
already a poor metabolizer and also takes an inhibitor), threshold traps (`*1/*4`,
`*1/*10`, `*41`), CYP2C19, unsupported alleles and missing data. Every recommendation is
taken word for word from the CPIC API, except atomoxetine at activity score 1.0 with a `*10` allele, which comes from the CPIC 2019 PDF because the API has only the other row, and the FDA label sentence shown for atomoxetine with a strong inhibitor.

## Sources

- CPIC opioids 2021: [PMC8249478](https://pmc.ncbi.nlm.nih.gov/articles/PMC8249478/)
- CPIC antidepressants 2023: [PDF](https://files.cpicpgx.org/data/guideline/publication/serotonin_reuptake_inhibitor_antidepressants/2023/37032427.pdf)
- CPIC atomoxetine 2019: [PDF](https://files.cpicpgx.org/data/guideline/publication/atomoxetine/2019/30801677.pdf)
- CPIC API: <https://api.cpicpgx.org/v1/>
- FDA CYP inhibitor examples: [fda.gov](https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems)

## Limitations

- **Synthetic data only.** No real patients, no real lab results.
- **Steady-state model.** Inhibitor onset and washout are not modeled; a medication is either on the list or not. This matters for fluoxetine: the CPIC atomoxetine 2019 guideline notes its inhibition may last up to 2-3 months after the drug is stopped, so a recently stopped fluoxetine will not be flagged. No washout calculation is implemented.
- **Phenoconversion is computed only where CPIC states the rule** (codeine and tramadol, CPIC opioids 2021). Atomoxetine with a strong inhibitor is handled like a poor metabolizer because the FDA label says so (section 2.5), with no activity-score multiplier; with a moderate inhibitor it is "Not assessed" and flagged for pharmacist review.
- **Several inhibitors on the list: the strongest one is applied.** This is a project design choice, not a CPIC rule.
- **Ultrarapid metabolizers on a strong inhibitor are flagged "reduced confidence"**, because they may not phenoconvert to the same extent (CPIC 2023).
- **CYP2C19 phenoconversion is not modeled.** No CPIC-stated adjustment rule for CYP2C19 was identified in the sources we checked, so RxGene does not compute one. The FDA interaction table lists fluoxetine as a strong inhibitor of CYP2C19 as well as CYP2D6, so a patient on fluoxetine who is prescribed clopidogrel may respond differently from what their genotype predicts, and RxGene will not flag it. Omeprazole with clopidogrel is shown as a label-level note only.
- **Clopidogrel indication.** Clopidogrel is modeled for acute coronary syndrome (ACS) and/or percutaneous coronary intervention (PCI) only. CPIC recommendations and recommendation strengths differ for neurovascular and other cardiovascular indications. RxGene does not collect or verify the patient's clinical indication, so its clopidogrel recommendations must not be generalized to all patients taking clopidogrel.
- **"No supported alert" is not the same as safe.** It means RxGene has no guideline-backed flag for that combination.
- **The AI summary never decides anything.** It rewrites the rule engine's output, is validated, and falls back to a fixed template.

## Disclaimer

RxGene is a hackathon prototype. It is not a medical device and is not validated for
clinical use. All patient data in this repository is synthetic.
