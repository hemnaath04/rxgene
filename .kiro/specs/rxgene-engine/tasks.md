# RxGene engine tasks

Build order follows the commit history. Hashes are matched from commit messages; a task is ticked only where the code in `web/` implements it as of 178bb2d.

- [x] 1. Reference data and fixtures (R1, R2, R13) — **done in 09cf825**
  - `data/cpic/` snapshots from the CPIC API (`cyp2d6_alleles.json`, `cyp2c19_alleles.json`, `recommendations/*.json`, `guidelines.json`) via `scripts/fetch_cpic.py`; `data/inhibitors.json` with the FDA CYP2D6 table (5 strong, 6 moderate, 10 weak).
  - `tests/fixtures/expected_outputs.json` and `.csv`, owned by the genetics reviewer.

- [x] 2. Activity score, phenotype and opioid phenoconversion (R1–R6, R10–R16, R26, R41, R43) — **done in f4f7e9e**
  - `activityScore.ts` (sum, exact duplication rows, `*NxK` × copies), `phenotype.ts` (0 / < 1.25 / ≤ 2.25 / above), `phenoconversion.ts` (strongest inhibitor; strong 0, moderate × 0.5 for codeine and tramadol only; weak note), `data.ts`.
  - `checkOrder.ts` orchestration and `recommend.ts` atomoxetine lookup by activity score (adults, quarter-step and `≥X` keys); `fixtures.test.ts`, `edge-cases.test.ts`. No onset or washout anywhere.

- [ ] 3. Exclude the assessed drug from its own inhibitor list (R9) — **not implemented. `applyPhenoconversion` passes `allMedications` (which contains the assessed drug) to `findStrongestInhibitor` with no exclusion step. It holds today only because none of codeine, tramadol, atomoxetine or clopidogrel is in `inhibitors.json`**
  - Filter `drug` out of the list before `findStrongestInhibitor`, and add a property test with a covered drug injected into the inhibitor table.

- [x] 4. Reverse case: adding a drug re-checks the list (R22) — **done in f4f7e9e (engine loop); card prefix "Adding X affects a current medication:" in e3d37bb**
  - `checkOrder` re-assesses every covered drug on the list against `meds + addedDrug`, with `triggeredBy` set to the added drug (fixture P12).
  - Re-checked drugs are returned only when phenoconverted or not GREEN, so an unchanged GREEN re-check produces no card (see task 18).

- [x] 5. CYP2C19 clopidogrel, genotype only (R27, R42) — **done in f4f7e9e**
  - `cyp2c19DiplotypeToPhenotype` maps functional statuses to a phenotype (our coding of CPIC's convention, not cross-checked; analysis #33); lookup by phenotype in `CVI ACS PCI`.
  - No CYP2C19 inhibitor logic; missing CYP2C19 → GREY with the CYP2C19 form of the R8 text.

- [x] 6. Plain functional UI (UI shell; no R1–R44 requirement on its own) — **done in ef021fb**
  - Patient picker, medication list and alert cards over `checkOrder`; replaced by the designed UI in tasks 10 and 19.

- [x] 7. CDS Hooks service (architecture spec §4; no R1–R44 requirement) — **done in 0fb3804; DSTU2 `MedicationOrder` in 0177430**
  - `web/api/cds-services.ts` discovery with prefetch templates; `cds-services/rxgene-order-select.ts` (prefetch genotype, then `fhirServer` fetch with 3 s timeout, then Insufficient data); `_lib/fhir.ts` ingredient matching via `KNOWN_DRUGS`.
  - `cdsCard.ts` `toCdsCard` (indicator mapping, ≤ 140-char summary, Markdown detail); dev API plugin; `cds-services.test.ts`.

- [x] 8. EHR mode, local fallback and URL state (architecture spec §3; no R1–R44 requirement) — **done in 3d81b0b**
  - `lib/cdsClient.ts` `buildRequest` / `send` (3 s timeout, never throws) / `alertFromCard`; `lib/cardEntries.ts` uses the server card's level and flags any mismatch with the local engine.
  - `lib/url.ts`: `?patient=&meds=&add=&mode=&lang=`, replace-state only; `cdsClient.test.ts`, `url.test.ts`.

- [ ] 9. Patient summary API (R33, R34, R35, R36, R37) — **partly done in cce086d; model call fixed in 1eb1226 (no `temperature`, model fallback list, Manifest error text treated as failure). Gaps: R35's GREEN check requires "not the same as safe" but not the "genotype result only" label; the banned-word regex in `_lib/llm.ts` does not catch the `un`-prefixed form that R33 lists**
  - `web/api/summary.ts` and `_lib/llm.ts`: engine fields only in the prompt, 6 s per model attempt, sha256 cache (500), 20/min/IP rate limit; validator for drug name, per-level action, banned words, new drugs, new numbers, every recommendation number kept, ≤ 90 words, no gene or phenotype terms.
  - `engine/templates.ts` EN/ES fixed templates; `PatientSummary.tsx` tags "AI-written from rule output" or "Template"; `summary.test.ts`.

- [x] 10. Designed UI: verdict bar, gauge, comparison strip, evidence sheet (R19, R39, R40) — **done in 38f4cd3**
  - Genotype and adjusted phenotype side by side in the evidence sheet ("Phenotype by genes" / "with current medications") and the two-marker gauge.
  - `lib/requirements.ts` `requirementsFor()` lists the requirement IDs behind each alert (checked by the fixture test via `tests_requirement`); R40 threshold note on every atomoxetine assessment.

- [ ] 11. Evidence fields on every alert with a recommendation (R38) — **partly done in 38f4cd3. Gap (b): for an R17 alert the card still shows the CPIC strength ("CPIC Atomoxetine · 2019 · Moderate") next to the FDA label source instead of the label source in its place**
  - Evidence sheet shows the recommendation verbatim in full, strength, guideline link, version and fetched date; R17 label and CPIC links via `sourceLinks`.
  - Alternatives appear only inside the quoted CPIC text; plain-language sentences say "Consider an alternative" without naming a drug.

- [x] 12. Science-review sync (R7, R8, R17, R24, R25, R29, R31, R32) — **done in da6b7ab**
  - Codeine and tramadol looked up by phenotype (`lookupByPhenotype`, `general`), so 0.625 maps to Intermediate; levels read only from `data/alert_levels.json` via `curatedAlertLevel`.
  - R17 label-based atomoxetine (no multiplier, "n/a" score, FDA text first, CPIC role, discrepancy flag, links); fixed R7/R8/GREEN texts in `fixedTexts.ts`; three distinct GREY headlines; GREEN labeled "Genotype result only".

- [ ] 13. Atomoxetine + moderate inhibitor: Not assessed (R18) — **partly done in da6b7ab; new R18 text in 1423791. Gap: with several moderate inhibitors the text names only the first one found, because `findStrongestInhibitor` returns a single drug; R18 requires all of them**
  - GREY, adjusted score `null`, `'not computed'`, `atomoxetineModerateNotAssessedText(inhibitor)`; does not say CPIC states no adjustment (fixture P16).

- [ ] 14. Missing curated level is a reported data error (R30) — **partly done in da6b7ab. Gap: `dataError` is set on the assessment and the level is GREY, but no UI or CDS card displays the `dataError` string, and there is no fixed text for this state (analysis #8, OPEN)**
  - `resolveAlert` returns GREY plus `dataError` for a missing entry, a missing row or an invalid level; never GREEN.

- [ ] 15. Ultrarapid + strong inhibitor on codeine/tramadol (R20) — **partly done in f4f7e9e and da6b7ab. Gap: the card level is the converted recommendation's level only; there is no "higher severity governs" step. The outcome is correct today because both rows are RED for codeine and tramadol**
  - `confidence: 'reduced'`, the `umReducedConfidenceNote` caveat, and `genotypeRecommendation` from the ultrarapid row, shown in the card detail and evidence sheet (fixture P06).

- [x] 16. Vercel serverless ESM fix (no R1–R44 requirement) — **done in a21a4c2**
  - Every file reachable from `web/api/` uses relative imports with `.js` and JSON `with { type: 'json' }`; no `@/` on the server path.

- [x] 17. Atomoxetine at activity score 1.0 with a `*10` allele (R44) — **done in 1423791**
  - `hasStar10Allele` (`*10`, `*10xN`, `*36+*10`) and `lookupAtomoxetineStar10` (curated `1.0 (*10 present)`, text from key `0.75`, YELLOW); without `*10`, the standard 1.0 row (fixtures P15, P25).
  - `ATOMOXETINE_AS1_CONTROVERSY_NOTE` shown in the evidence sheet for activity score 1.0.

- [ ] 18. Omeprazole–clopidogrel label note (R28) — **partly done in 1423791 (note on the card itself); brand names removed in 7953d82. Gap: when clopidogrel is already on the list with a GREEN result and omeprazole is the drug being added, the re-checked clopidogrel carries `labelNote` but is dropped by the reverse-case filter (task 4), so no card shows the note (analysis #21)**
  - `OMEPRAZOLE_CLOPIDOGREL_LABEL_NOTE` set when omeprazole is on the list; shown in `AlertCard`, the story row and the evidence sheet; no CYP2C19 phenoconversion (fixture P19).

- [x] 19. Molecular workbench UI (R19, R32) — **done in c41de38; neutral pathway for uncomputed and unknown results in 38330ee; merged in 53b0600; final reference UI in b97f0dd and 178bb2d**
  - Guided particle flow showing genotype vs adjusted state; uncomputed dosing and unknown gene results stay neutral instead of implying a speed.
  - Uncovered drugs get a GREY "Not assessed" card (`cardEntries.ts` `uncovered`).

- [x] 20. R21 precedence over R18 and R17 for genotype poor metabolizers (R18, R21) — **spec and fixture P26 in 7953d82; code in 7af163b**
  - `applyPhenoconversion` checks genotype score 0 before the atomoxetine branches, so any inhibitor gives the drug-level alert plus the exact R21 note naming the inhibitor (P02, P26, edge cases).
  - The verdict bar shows a plain-language form of the note; the evidence sheet shows the exact text.

- [x] 21. Property-based tests (R3–R8, R10–R13, R21, R33) — **done in 568a9e6 (recorded R21 counterexample `*100/*100` + abiraterone + atomoxetine, fixed by task 20)**
  - `properties.test.ts` (fast-check, 300 runs each): banned words, R10/R11/R13 adjustment, R12 no-change, monotonic phenotype and exact boundaries, R7/R8 GREY, R21 note.
  - The file's "KNOWN FAILURE" comment predates 7af163b. Verified at 178bb2d: the full suite passes (154/154), including the R21 property.

- [x] 22. Consult agent uses the engine read-only (R34) — **done in d558eca; fixes in 137798e and e38aca8**
  - `web/api/_lib/agentTools.ts` `check_drug` calls `checkOrder` and has no tool that changes an alert. R45–R56 and their gaps are tracked in `../consult-agent/tasks.md`.

- [x] 23. openFDA FAERS reports panel (no R1–R44 requirement) — **done in e094f0c**
  - `lib/openfda.ts` and the evidence-sheet panel over `data/openfda/pair_reports.json`, labeled unvalidated and not for medical decisions; it does not affect any level.

- [x] 24. Requirement coverage check (R1–R44, R23 removed) — **every requirement in R1–R44 is covered by at least one task above; none is uncovered**
  - Covered only by unticked tasks, so still open: R9 (3), R18 multi-inhibitor naming (13), R20 (15), R28 (18), R30 (14), R33 and R35 for the summary validator (9), R38 (11).
