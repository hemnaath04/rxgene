// Fixed clinical strings that do NOT come from data/ (CPIC snapshots or alert_levels.json).
// Every string here is quoted verbatim from .kiro/specs/rxgene-engine/requirements.md or from
// tests/fixtures/expected_outputs.json, with its R-number noted (GREEN_SCOPE_TEXT and
// ATOMOXETINE_AS1_CONTROVERSY_NOTE are display wording for R31/R44, not quotes). This is the ONE
// place these strings may live: no other engine/UI file may contain them (they flow through from here).
// GREY has exactly three fixed texts: R7 (Indeterminate), R8 (Insufficient data), R18 (Not assessed).

/**
 * R7 — GREY, Indeterminate: one or more alleles have no activity value.
 * Verbatim from requirements.md R7.
 */
export const INDETERMINATE_TEXT =
  'Indeterminate: this gene result includes a variant we cannot interpret, so no pharmacogenomic check was done for this drug. Ask a pharmacist.';

/**
 * R8 — GREY, Insufficient data: the CYP2D6 gene result is missing.
 * Verbatim from requirements.md R8 (CYP2D6). `gene` is a parameter only so a parallel
 * message can be produced for CYP2C19; with gene = 'CYP2D6' this reproduces R8 exactly.
 */
export function insufficientDataText(gene: string = 'CYP2D6'): string {
  return `Insufficient data: there is no ${gene} result on file, so no pharmacogenomic check was done for this drug.`;
}

/** The exact R8 string (CYP2D6), for places that need the literal. */
export const INSUFFICIENT_DATA_TEXT = insufficientDataText('CYP2D6');

/**
 * R18 / R32 — GREY, Not assessed: atomoxetine with a moderate CYP2D6 inhibitor (and no strong
 * one). RxGene has no validated adjustment, so nothing is computed. Verbatim template from
 * requirements.md R18 / fixture P16, with {Inhibitor} = the moderate inhibitor's name, capitalized.
 */
export function atomoxetineModerateNotAssessedText(inhibitorDrug: string): string {
  const inhibitor = inhibitorDrug.charAt(0).toUpperCase() + inhibitorDrug.slice(1);
  return `Not assessed: ${inhibitor} is a moderate CYP2D6 inhibitor. RxGene does not have a validated phenoconversion adjustment for atomoxetine with moderate inhibitors. The genotype-based result remains available, but the medication-adjusted phenotype has not been determined. Pharmacist review recommended.`;
}

// ---- R31: GREEN ----

/** R31/R33 — the fixed GREEN text. Never reword it or reuse its last word elsewhere. */
export const GREEN_ALERT_TEXT = 'No supported PGx alert (not the same as safe)';

/** R31 — GREEN is the genotype result only, never an overall medication clearance. */
export const GREEN_SCOPE_TEXT = 'Genotype result only. This is not an overall medication clearance.';

// ---- R28: omeprazole + clopidogrel (label-level, not a computed phenoconversion) ----

/** R28 — verbatim from requirements.md R28 / fixture P19 extra_flag. */
export const OMEPRAZOLE_CLOPIDOGREL_LABEL_NOTE =
  'Label interaction: FDA PLAVIX label advises avoiding concomitant use of omeprazole or esomeprazole. Shown separately from the genotype result.';

// ---- R44: atomoxetine at activity score 1.0 ----

/**
 * R44 — CPIC's "controversy remains" note for activity score 1.0, kept visible in the evidence
 * drawer. Wording from the alert_levels.json curatedNote for "1.0 (*10 present)".
 */
export const ATOMOXETINE_AS1_CONTROVERSY_NOTE =
  "CPIC atomoxetine 2019 rates the activity score 1.0 recommendation Moderate (controversy remains). The row depends on the *10 allele: '1.0 (*10 allele present)' uses the titration text; '1.0 (*10 allele not present)' uses the standard text.";

// ---- R17: atomoxetine + strong CYP2D6 inhibitor (FDA label-based handling) ----

/**
 * R17 — the adjusted activity score is shown as "n/a" (no score computed); no ×0 / ×0.5
 * multiplier is applied. Verbatim phenotype description from requirements.md R17 / fixture P13.
 */
export const ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE = 'Poor-metabolizer-equivalent dosing (FDA label)';

/** R17 — the human-readable "n/a" adjusted-activity-score string shown on the card (fixture P13 adjusted_AS). */
export const ATOMOXETINE_LABEL_ADJUSTED_AS = 'n/a (label-based, no score computed)';

/**
 * R17 — the FDA STRATTERA label (section 2.5) recommendation, shown FIRST on the card.
 * Verbatim from fixture P13 label_recommendation.
 */
export const ATOMOXETINE_LABEL_RECOMMENDATION =
  'FDA STRATTERA label, section 2.5 (adult, concomitant strong CYP2D6 inhibitor): "a longer titration interval of 4 weeks is recommended", "if ADHD symptoms fail to improve and the initial STRATTERA dosage is well tolerated". Starting, target and maximum dosages are the same as the label\'s standard adult table (40 mg/day start, 80 mg/day target, 100 mg/day maximum).';

/**
 * R17 — the role of the CPIC 2019 poor-metabolizer text: supporting genotype-based context only,
 * not an equally applicable dosing instruction. Verbatim from fixture P13 cpic_role.
 */
export const ATOMOXETINE_CPIC_ROLE =
  'Supporting genotype-based context only (CPIC 2019 poor-metabolizer guidance); not an equally applicable dosing instruction for inhibitor-induced phenoconversion.';

/**
 * R17 — the fixed "Different guidance contexts" discrepancy flag. Verbatim from requirements.md R17
 * / fixture P13 discrepancy_flag.
 */
export const ATOMOXETINE_DISCREPANCY_FLAG =
  'Different guidance contexts: FDA labeling directly addresses strong CYP2D6 inhibitor coadministration and recommends a 4-week titration interval. CPIC 2019 provides genotype-based poor-metabolizer guidance with a 2-week response assessment. These recommendations should not be treated as interchangeable.';

/** R17 — source links (FDA STRATTERA label + CPIC atomoxetine 2019). Verbatim from fixture P13 source_links. */
export const ATOMOXETINE_SOURCE_LINKS =
  'FDA STRATTERA label, DailyMed set id 309de576-c318-404a-bc15-660c2b1876fb, version 69 (2026-07-23): https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=309de576-c318-404a-bc15-660c2b1876fb | CPIC atomoxetine guideline 2019 (Brown et al.): https://pmc.ncbi.nlm.nih.gov/articles/PMC6612570/';

// ---- R20: ultrarapid metabolizer + strong inhibitor on codeine/tramadol ----

/**
 * R20 — the caveat shown when a genotype-ultrarapid patient is phenoconverted by a strong
 * inhibitor on codeine/tramadol. Both the converted and the genotype recommendation are shown.
 * Verbatim template from fixture P06 inhibitor_note ({inhibitor} and {drug} filled in).
 */
export function umReducedConfidenceNote(inhibitorDrug: string, drug: string): string {
  return `Caveat: CPIC 2023 notes ultrarapid metabolizers may not phenoconvert with ${inhibitorDrug}. Both recommendations are shown (converted and genotype); both say avoid ${drug}.`;
}
