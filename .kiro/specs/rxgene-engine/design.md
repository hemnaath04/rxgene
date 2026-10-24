# RxGene engine design

Source of truth: `requirements.md` (R1–R56, R23 removed). This file describes the engine **as built** in `web/src/engine/`, `web/api/` and `web/src/lib/`; where the code falls short of a requirement, it says so and `tasks.md` leaves that task unticked. The consult agent (R45–R56) has its own `../consult-agent/design.md`.

Principle: **deterministic rules decide; the AI only rewrites and is validated** (R34). The engine is plain TypeScript with no `fetch`, no React and no model call. An LLM only rewrites an engine result as a patient summary (`/api/summary`) or a consult note (`/api/consult`); both outputs go through deterministic validators and fall back to a fixed template.

## Diagram

```
data/ (CPIC snapshots, inhibitors.json, alert_levels.json)    tests/fixtures/expected_outputs.json
   │  npm run sync-data (predev / prebuild / pretest)                        │
   ▼                                                                         ▼
web/src/data/ (generated copy) ──► web/src/engine/ checkOrder() ──► DrugAssessment[] ◄── vitest
                                        │
        ┌───────────────────────────────┼────────────────────────────┬─────────────────────────┐
        ▼                               ▼                            ▼                         ▼
 toCdsCard() → CdsCard        UI (browser, local engine)     /api/summary              /api/consult
 /cds-services/rxgene-        verdict.ts, EvidenceSheet,     LLM rewrite → validate    agent tools call
 order-select (EHR)           requirements.ts (R39 IDs)      → or renderTemplate()     checkOrder read-only

EHR mode (default): buildRequest() → POST order-select (3 s) → cards set the level; the local
                    assessments fill the detail; any level/drug disagreement is shown as a mismatch.
Error or 3 s timeout → localEntries(..., 'local-fallback'): same engine in the browser, badge "local fallback".
Local mode (?mode=local): checkOrder() in the browser only, no network.
```

## 1. Data model (`types.ts`)

**Patient:** `{ id, name, cyp2d6?, cyp2c19?, meds: string[] }`. `meds` excludes the drug being added.

**DrugAssessment** (one per assessed drug):

| Field | Meaning |
|---|---|
| `drug` / `triggeredBy` | Drug the alert is about / drug just added (differ in the reverse case, R22) |
| `gene` | `'CYP2D6'` or `'CYP2C19'` |
| `genotype` | Diplotype string, or `null` when missing |
| `genotypeActivityScore` | Sum of allele values; `null` for CYP2C19, missing or indeterminate |
| `genotypePhenotype` | Metabolizer phenotype, or a status string starting `Indeterminate (…)` / `Insufficient data (…)` |
| `inhibitor` | Strongest strong/moderate CYP2D6 inhibitor `{ drug, strength }`; weak inhibitors stay `null` and appear only in `inhibitorNote` |
| `adjustedActivityScore` | Score after R10/R11; `null` for R17, R18, CYP2C19 and GREY states |
| `adjustedActivityScoreLabel?` | R17 display string `n/a (label-based, no score computed)` |
| `adjustedPhenotype` | Converted phenotype; `'not computed'` (R18); R17 description; equals the genotype status for R7/R8 |
| `phenoconverted` | `true` / `false`; `null` when it cannot be determined (R7, R8, R18) |
| `confidence` | `'standard'` or `'reduced'` (R20) |
| `alert` | `RED` / `YELLOW` / `GREEN` / `GREY`, always from `alert_levels.json` or a GREY rule |
| `recommendation` | CPIC text verbatim, or a fixed GREY text (R7, R8, R18) |
| `strength` | CPIC classification; empty for GREY |
| `inhibitorNote?` | R12 weak note, R20 caveat, or R21 note |
| `labelNote?` | R28 omeprazole–clopidogrel fixed text |
| `genotypeRecommendation?` | R20: genotype (ultrarapid) recommendation shown beside the converted one |
| `labelRecommendation?`, `cpicRole?`, `discrepancyFlag?`, `sourceLinks?` | R17: FDA label text (shown first), role of the CPIC text, "Different guidance contexts" flag, label + CPIC links |
| `dataError?` | R30: no curated level or no matching row; the alert is GREY |
| `source` | `{ guideline, url, fetched }` from `guidelines.json` and the snapshot date |

**CdsCard** (`toCdsCard`): `summary` (≤ 140 chars, tested), Markdown `detail` (both phenotypes, scores, inhibitor, recommendation, strength, notes, R17 label text first), `indicator` (RED → `critical`, YELLOW → `warning`, GREEN/GREY → `info`), `source { label, url }`, and a guideline link. `alertFromCard` in `cdsClient.ts` inverts the mapping; GREEN and GREY are told apart by the fixed GREEN text in the summary.

## 2. Algorithm (`checkOrder.ts`)

`checkOrder(patient, addedDrug)` builds `allMedications = meds + addedDrug`, assesses the added drug, then re-checks every covered drug already on the list (R22). A re-checked drug is returned only if it is phenoconverted or not GREEN. Uncovered drugs (`drugToGene` has no entry) return nothing; the UI shows them as GREY "Not assessed" (R32).

**CYP2D6 (codeine, tramadol, atomoxetine):**

1. **Activity score** (`activityScore.ts`, R1, R2, R7, R8). Missing genotype → `Insufficient data`. Split on `/`; anything but two alleles → `Indeterminate`. Each allele uses its exact row in `cyp2d6_alleles.json` (e.g. `*1x2`, `*1x≥3`); otherwise `*NxK` is split and the base value is multiplied by K. An allele that is absent, has a null value, or fails to parse → `Indeterminate`, no partial score.
2. **Inhibitor** (`phenoconversion.ts`, R12, R13). `findStrongestInhibitor` scans the list for strong, then moderate, then weak names from `inhibitors.json`; unlisted drugs are never inhibitors. The assessed drug is **not** removed from the list (R9); this is harmless today only because none of the four covered drugs is in `inhibitors.json`.
3. **R21 first.** Genotype score 0 plus any inhibitor → adjusted score 0, phenotype Poor Metabolizer, R21 note naming the inhibitor. Checked before R18 and R17, so a genotype poor metabolizer always gets the drug-level alert.
4. **Atomoxetine + moderate** (R18) → adjusted `null`, `'not computed'`, GREY with the R18 text naming the one inhibitor `findStrongestInhibitor` returned.
5. **Atomoxetine + strong** (R17, R41) → no multiplier; adjusted score `null` with the "n/a" label, phenotype "Poor-metabolizer-equivalent dosing (FDA label)". The alert and supporting CPIC text come from the atomoxetine adults `0.0` row (YELLOW); the four R17 label fields are attached.
6. **Weak only** (R12) → no change plus the fixed weak note.
7. **Codeine/tramadol** (R10, R11, R14–R16, R41) → strong: 0; moderate: × 0.5; remap with R3–R6. Ultrarapid genotype + strong → `confidence: 'reduced'`, the R20 caveat, and `genotypeRecommendation` from the ultrarapid row (R20).
8. **Phenotype** (`phenotype.ts`, R3–R6): `0` Poor; `< 1.25` Intermediate; `≤ 2.25` Normal (1.25 and 2.25 inclusive); above that Ultrarapid.
9. **Lookup** (`recommend.ts`): codeine and tramadol by phenotype, population `general` (R24, R25), so 0.625 maps to Intermediate. Atomoxetine by activity score, population `adults` (R26): nearest quarter-step exact key, else the largest `≥X` key ≤ the score. At exactly 1.0 with a `*10` allele (`hasStar10Allele`: `*10`, `*10xN`, `*36+*10`), `lookupAtomoxetineStar10` reads the `1.0 (*10 present)` entry, whose `useRecommendationKey: "0.75"` supplies the text (YELLOW, R44); without `*10`, the standard `1.0` row (GREEN).
10. **Alert level** (R29, R30): `curatedAlertLevel(drug, population, key)` from `alert_levels.json`, keyed by phenotype or activity-score key. No entry, no row, or an invalid level → GREY + `dataError`. The text is never inspected.

**CYP2C19 (clopidogrel):** missing → GREY with the CYP2C19 form of the R8 text; else `cyp2c19DiplotypeToPhenotype` maps the two functional statuses directly (R27; our coding of CPIC's convention), lookup by phenotype in `CVI ACS PCI`. Omeprazole on the list → `labelNote` (R28). No CYP2C19 phenoconversion (R42).

**Three GREY states** (R7, R8, R18/R32), each with its own fixed text; the UI headlines are "Indeterminate: ask a pharmacist", "Insufficient data", "Not assessed: refer to pharmacist". None reuses the GREEN wording. A fourth GREY cause, the R30 data error, has no fixed text yet (analysis #8, OPEN).

## 3. Fixed clinical texts

`fixedTexts.ts` holds the strings that do not come from `data/`: R7, R8 (`insufficientDataText(gene)`), R18 template, GREEN text and its "Genotype result only" scope line (R31), R28 label note, R44 controversy note, the five R17 strings, the R20 caveat template, and the inhibitor-only texts used by the consult agent. Each carries its R-number and is quoted from `requirements.md` or the fixtures.

Why one file: the reviewer's wording must reach every surface unchanged, and the fixture test compares `recommendation`, `labelRecommendation`, `discrepancyFlag`, `cpicRole`, `sourceLinks`, `genotypeRecommendation` and `labelNote` by **exact match**, so any edit shows up as a failing fixture. UI and API files import the constants instead of retyping them.

Not yet in that file: the R21 and R12 notes are written inline in `phenoconversion.ts`; the R40 threshold notes are in `EvidenceSheet.tsx`; patient templates are in `templates.ts`. The verdict bar shows a plain-language form of the R21 note; the evidence sheet shows it verbatim.

## 4. Correctness properties and fixtures

`properties.test.ts` (fast-check, 300 runs each; alleles and inhibitors are drawn from the data files):

| Property | Requirement |
|---|---|
| No banned word in recommendation, notes, card summary or detail, except the phrase "not the same as safe" | R33 |
| Codeine/tramadol: adjusted score ≤ genotype score | R10, R11, R13 |
| Any strong inhibitor → adjusted score exactly 0 | R10 |
| Moderate without strong (with and without weak) → exactly 0.5 × genotype score | R11 |
| Mixed classes → only the strongest class applies | R13 |
| Weak only or none → same score and phenotype | R12, R13 |
| Phenotype is monotonic in the score (direct mapping and through `checkOrder`) | R3–R6 |
| Exact boundaries at 0, 1.25 and 2.25 | R3–R6 |
| Unknown or no-value allele → GREY, never GREEN | R7 |
| Missing or empty CYP2D6 → GREY, never GREEN | R8 |
| Genotype score 0 + any inhibitor → never GREEN or GREY, and the R21 note (all three CYP2D6 drugs) | R21 |

The R21 property produced the recorded counterexample `["*100/*100", ["abiraterone"], "atomoxetine"]` (568a9e6). The R21-first branch in step 3 was added in 7af163b; the in-file "KNOWN FAILURE" comment predates it.

**Fixtures:** `fixtures.test.ts` runs every row of `tests/fixtures/expected_outputs.json` (P01–P26 in the file today; README and steering still say 25 and 22). It checks alert, both phenotypes, the CPIC text verbatim, confidence, scores, inhibitor and class, `triggeredBy`, the R17/R20/R28 fields, the R39 IDs named in `tests_requirement`, GREY text never reusing GREEN wording, and a card summary ≤ 140 chars. The genetics reviewer owns the fixtures, `data/` and `alert_levels.json`; `scripts/kiro-guard-clinical-data.mjs` (a `preToolUse` hook) blocks Kiro from writing `data/cpic/`, `data/inhibitors.json` and `tests/fixtures/` (not `alert_levels.json`). **When code and a reviewed fixture disagree, the reviewer wins and the code changes.** `edge-cases.test.ts` adds `*4x2`, `*1x≥3` (no NaN) and R21 with weak and moderate inhibitors.

## 5. Error handling and degradation

| Situation | Behavior |
|---|---|
| Missing / uninterpretable genotype | GREY with the R8 / R7 text; never a default phenotype |
| No row or no curated level | GREY + `dataError` (R30); the evidence sheet shows "No recommendation text (see the data error)" but not the `dataError` string |
| Summary LLM unset, HTTP error, empty, truncated, gateway text in a 200, 6 s per model attempt, validation failure | Next model in `LLM_MODEL`, then `renderTemplate()` labeled "Template" (R36); the template shows first and AI text replaces it only after it passes (R37) |
| Summary rate limit (20/min/IP) | Template with `rateLimited: true` |
| CDS call fails, bad JSON or > 3 s (`CDS_TIMEOUT_MS`) | `send()` never throws; UI uses the local engine, badge "local fallback" |
| FHIR server fetch for genotype (3 s) fails | Genotype null → Insufficient data |
| Unknown selected ingredient | `{ cards: [] }` |

**Vercel ESM rule (a21a4c2):** every file reachable from `web/api/` runs as plain Node ESM, so relative imports end in `.js`, JSON imports use `with { type: 'json' }`, and there is no `@/` alias. `data.ts` follows this; browser-only files (`lib/`, components) may use `@/`.

## 6. Design decisions

- **Strongest inhibitor only.** CPIC gives no rule for combining inhibitors; applying the strongest class is a project choice, stated in `inhibitors.json` and the README (R13).
- **Steady state.** A drug is on the list or not; no onset or washout (R43). A recently stopped fluoxetine is not flagged.
- **Multiplier only for codeine and tramadol.** Only CPIC opioids 2021 states it; atomoxetine with a strong inhibitor follows the FDA label, and with a moderate one is not computed (R17, R18, R41).
- **No CYP2C19 phenoconversion.** No CPIC-stated rule was found; omeprazole is a label note only (R28, R42).
- **Levels are curated, not inferred.** Atomoxetine normal and ultrarapid share dosing text but differ in level, so text-based rules would be wrong (R29, R30).
- **GREEN is not a clearance.** GREEN means "No supported PGx alert (not the same as safe)" and is labeled a genotype result only (R31, R33).
- **R39 IDs are derived, not emitted.** `requirementsFor()` in `web/src/lib/requirements.ts` rebuilds the IDs from assessment fields for the evidence sheet; CDS cards carry none.
