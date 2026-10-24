# RxGene

**Your genes don't change. Your prescriptions do.**

RxGene is a pre-prescription pharmacogenomics (PGx) check. When a clinician adds a
medication, it re-checks the patient's existing genetic test results against
[CPIC](https://cpicpgx.org) guidelines **and** the patient's current medications. That way
it catches **phenoconversion**: a patient who is genetically a normal CYP2D6 metabolizer
but takes fluoxetine behaves like a poor metabolizer, so codeine won't relieve their pain.

> Built at Hackachusetts 2026 (Biotech & Healthcare track). Synthetic data only.
> RxGene supports clinicians and pharmacists. It does not replace them.

**Team docs:** [Who does what](docs/TEAM-SPLIT.md) · [Build spec](.plans/rxgene-build-spec.md) · [Plan v3](docs/PLAN-v3.md) · [Clinical rules](.kiro/steering/clinical-rules.md)

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

## Repo layout

```
.kiro/steering/   product, tech, structure, and clinical rules (Kiro loads these every session)
web/              React + Vite + TS app (scaffold in Kiro); engine goes in web/src/engine/
server/           small Node endpoint for LLM extraction/explanation
data/cpic/        CPIC API snapshots: allele values, recommendations, guideline links
data/             inhibitors.json, synthetic-reports/
tests/fixtures/   expected outputs for 22 synthetic test patients
scripts/          fetch_cpic.py (refresh snapshots), make_expected.py (regenerate fixtures)
docs/             TEAM-SPLIT (who does what), PLAN-v3 (strategy + pitch), verified answers
.plans/           build spec (source of truth for what we build)
```

## Getting started

1. Open this folder in **Kiro**. The rules in `.kiro/steering/` load automatically.
2. Scaffold the app in `web/` (React + Vite + TypeScript). If the tool warns that the
   folder isn't empty, choose to ignore the existing files.
3. `cp .env.example .env` and add your LLM key. Never commit `.env`.
4. Refresh the data if needed: `python3 scripts/fetch_cpic.py`.
5. Build the engine against `tests/fixtures/expected_outputs.json` first, then the UI.

## Git workflow

- Push straight to `dev`. `main` only changes through a PR from `dev`.
- After cloning, run `git config core.hooksPath .githooks` once. The hook blocks direct pushes to `main`.
- Merge `dev` into `main` (via PR) before submitting. Judges read `main`.

## Test patients

22 synthetic cases cover genotype-only alerts, phenoconversion (strong, moderate and weak
inhibitors, plus the reverse case where adding an inhibitor re-alerts a drug already on the list), alert de-escalation (a patient who is
already a poor metabolizer and also takes an inhibitor), threshold traps (`*1/*4`,
`*1/*10`, `*41`), CYP2C19, unsupported alleles and missing data. Every recommendation is
taken word for word from the CPIC API.

## Sources

- CPIC opioids 2021: [PMC8249478](https://pmc.ncbi.nlm.nih.gov/articles/PMC8249478/)
- CPIC antidepressants 2023: [PDF](https://files.cpicpgx.org/data/guideline/publication/serotonin_reuptake_inhibitor_antidepressants/2023/37032427.pdf)
- CPIC atomoxetine 2019: [PDF](https://files.cpicpgx.org/data/guideline/publication/atomoxetine/2019/30801677.pdf)
- CPIC API: <https://api.cpicpgx.org/v1/>
- FDA CYP inhibitor examples: [fda.gov](https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems)

## Disclaimer

RxGene is a hackathon prototype. It is not a medical device and is not validated for
clinical use. All patient data in this repository is synthetic.
