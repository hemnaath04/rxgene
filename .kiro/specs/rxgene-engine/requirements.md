# RxGene Engine Requirements (EARS format)

**Version:** 1.0  
**Date:** 2026-10-24  
**Source:** PLAN-v3 "Kiro spec", rxgene-build-spec sections 1, 2 and 4, clinical-rules.md

Every alert in the system SHALL trace back to a numbered requirement. These requirements
are deterministic rules that the AI component never modifies.

---

## Activity Score and Phenotype Mapping

**R1:** WHEN a patient has a CYP2D6 genotype consisting of two alleles with known activity values, THE SYSTEM SHALL compute the activity score as the sum of the two allele activity values from `data/cpic/cyp2d6_alleles.json`.

**R2:** WHEN a CYP2D6 allele includes a duplication (e.g., `*1x2`), THE SYSTEM SHALL multiply that allele's activity value by the copy number before summing.

**R3:** WHEN the computed CYP2D6 activity score equals 0, THE SYSTEM SHALL assign the phenotype "Poor Metabolizer".

**R4:** WHEN the computed CYP2D6 activity score is greater than 0 and less than 1.25, THE SYSTEM SHALL assign the phenotype "Intermediate Metabolizer".

**R5:** WHEN the computed CYP2D6 activity score is greater than or equal to 1.25 and less than or equal to 2.25, THE SYSTEM SHALL assign the phenotype "Normal Metabolizer".

**R6:** WHEN the computed CYP2D6 activity score is greater than 2.25, THE SYSTEM SHALL assign the phenotype "Ultrarapid Metabolizer".

**R7:** WHEN a patient's CYP2D6 genotype contains one or more alleles with no activity value in the reference data, THE SYSTEM SHALL assign the phenotype "Indeterminate (Not assessed)" AND SHALL issue a GREY-level alert AND SHALL NOT default to normal metabolizer.

**R8:** WHEN a patient's CYP2D6 gene result is missing or not provided, THE SYSTEM SHALL assign the status "Insufficient data" AND SHALL issue a GREY-level alert.

---

## Phenoconversion: Inhibitor Adjustment

**R9:** WHEN checking a drug for CYP2D6 phenoconversion, THE SYSTEM SHALL exclude that drug itself from the list of inhibitors considered, so a drug never phenoconverts its own recommendation.

**R10:** WHEN computing phenoconversion for codeine or tramadol AND a patient takes one or more CYP2D6 inhibitors (excluding the drug being assessed) AND the strongest inhibitor is classified as "strong", THE SYSTEM SHALL set the adjusted activity score to 0.

**R11:** WHEN computing phenoconversion for codeine or tramadol AND a patient takes one or more CYP2D6 inhibitors (excluding the drug being assessed) AND the strongest inhibitor is classified as "moderate" AND no strong inhibitor is present, THE SYSTEM SHALL multiply the genotype activity score by 0.5 to compute the adjusted activity score.

**R12:** WHEN computing phenoconversion for codeine or tramadol AND a patient takes one or more CYP2D6 inhibitors (excluding the drug being assessed) AND the strongest inhibitor is classified as "weak" AND no strong or moderate inhibitor is present, THE SYSTEM SHALL use the genotype activity score as the adjusted activity score without modification AND SHALL include a note that weak inhibitors were present.

**R13:** WHEN multiple CYP2D6 inhibitors are present on the medication list (excluding the drug being assessed), THE SYSTEM SHALL apply only the strongest inhibitor's adjustment factor.

**R14:** WHEN an adjusted activity score has been computed for codeine or tramadol due to an inhibitor, THE SYSTEM SHALL map the adjusted score to an adjusted phenotype using the thresholds in R3–R6.

**R15:** WHEN computing phenoconversion for codeine, THE SYSTEM SHALL apply the inhibitor adjustment rules (R10–R14).

**R16:** WHEN computing phenoconversion for tramadol, THE SYSTEM SHALL apply the inhibitor adjustment rules (R10–R14).

**R17:** WHEN computing phenoconversion for atomoxetine AND a strong CYP2D6 inhibitor is present (excluding atomoxetine itself), THE SYSTEM SHALL apply the strong-inhibitor adjustment (adjusted activity score 0, adjusted phenotype Poor Metabolizer) AND SHALL use the poor-metabolizer-equivalent recommendation from CPIC atomoxetine 2019.

**R18:** WHEN computing phenoconversion for atomoxetine AND a moderate CYP2D6 inhibitor is present (excluding atomoxetine itself) AND no strong inhibitor is present, THE SYSTEM SHALL assign the status "not computed" AND SHALL issue a GREY-level alert with the text "pharmacist review" AND SHALL NOT compute an adjusted activity score.

**R19:** WHEN phenoconversion has been applied, THE SYSTEM SHALL display both the genotype phenotype and the adjusted phenotype side by side in the alert details.

---

## Edge Cases: Confidence and De-escalation

**R20:** WHEN a patient's genotype phenotype is "Ultrarapid Metabolizer" AND a strong CYP2D6 inhibitor is present, THE SYSTEM SHALL compute the adjusted phenotype per R10 and R14 AND SHALL flag the result with "reduced confidence" AND SHALL include a note that ultrarapid metabolizers may not phenoconvert to the same extent.

**R21:** WHEN a patient's genotype activity score is 0 (poor metabolizer by genotype) AND any CYP2D6 inhibitor is present, THE SYSTEM SHALL still issue the drug-level alert for that phenotype AND SHALL include an inhibitor note stating "adds no further effect — this patient was already a poor metabolizer by genotype."

**R22:** WHEN an inhibitor drug is added to a patient's medication list, THE SYSTEM SHALL re-check every drug already on the medication list for CYP2D6-related alerts.

**R23:** WHEN a medication list entry for fluoxetine carries a 'recently stopped' marker, THE SYSTEM SHALL treat it as an active strong CYP2D6 inhibitor.

> **Note:** R23 requires a 'recently stopped' field on medication entries (for drugs stopped < 3 months ago). The build spec section 4 Patient type does not include this field yet; it will be added if time permits.

---

## Recommendation Lookup and Alert Levels

**R24:** WHEN looking up a CPIC recommendation for codeine, THE SYSTEM SHALL use the activity score (genotype or adjusted) as the lookup key, not the phenotype label.

**R25:** WHEN looking up a CPIC recommendation for tramadol, THE SYSTEM SHALL use the activity score (genotype or adjusted) as the lookup key, not the phenotype label.

**R26:** WHEN looking up a CPIC recommendation for atomoxetine in the absence of moderate inhibitors, THE SYSTEM SHALL use the activity score (genotype or adjusted) as the lookup key AND SHALL use the "adults" population.

**R27:** WHEN looking up a CPIC recommendation for clopidogrel, THE SYSTEM SHALL use the CYP2C19 phenotype (mapped directly from diplotype, without activity score computation) AND SHALL use the "CVI ACS PCI" population.

**R28:** WHEN a patient taking clopidogrel is also taking omeprazole, THE SYSTEM SHALL include a separate label-level note for the omeprazole–clopidogrel interaction AND SHALL NOT compute CYP2C19 phenoconversion.

**R29:** WHEN a CPIC recommendation begins with the word "Avoid", THE SYSTEM SHALL assign a RED-level alert.

**R30:** WHEN a CPIC recommendation includes a dose adjustment, titration instruction, or the phrase "if no response, consider", THE SYSTEM SHALL assign a YELLOW-level alert.

**R31:** WHEN a CPIC recommendation indicates standard dosing with no special precautions, THE SYSTEM SHALL assign a GREEN-level alert AND SHALL display the message "No supported PGx alert (not the same as safe)".

**R32:** WHEN no CPIC recommendation is available for a given drug–phenotype combination, OR the phenotype is "Indeterminate (Not assessed)", OR the status is "Insufficient data", THE SYSTEM SHALL assign a GREY-level alert.

**R33:** THE SYSTEM SHALL NOT display the word "Safe" or "seguro" anywhere in the UI, alerts, summaries or reports.

---

## AI Component Safety

**R34:** THE SYSTEM SHALL NOT allow the AI component to decide whether an alert appears, what alert level is assigned, or what CPIC recommendation is selected.

**R35:** WHEN the AI component generates a plain-language summary, THE SYSTEM SHALL validate that the summary contains the correct drug name, preserves the alert action (e.g., "avoid" for RED alerts), names no drug not in the input, contains no number not in the input, and is 90 words or fewer.

**R36:** WHEN the AI-generated summary fails validation OR the AI request times out after 6 seconds, THE SYSTEM SHALL display a fixed template summary instead AND SHALL label it "Template".

**R37:** WHEN the AI-generated summary passes validation, THE SYSTEM SHALL label it "AI-written from rule output".

---

## Evidence and Traceability

**R38:** WHEN issuing any alert, THE SYSTEM SHALL include the CPIC guideline name, evidence strength classification, guideline URL, and data fetch date.

**R39:** WHEN issuing any alert, THE SYSTEM SHALL identify which numbered requirement (R1–R43) triggered the alert so the clinician can trace the decision path.

**R40:** WHEN a patient's case involves activity score thresholds that differ from those in the 2019 CPIC atomoxetine supplement, THE SYSTEM SHALL display a note that the current standardized thresholds are used and the older convention differs.

---

## Scope and Limitations

**R41:** THE SYSTEM SHALL apply computed phenoconversion by activity score multiplier (strong inhibitor ×0, moderate inhibitor ×0.5) only to codeine and tramadol, per CPIC opioids 2021, AND SHALL handle atomoxetine with a strong CYP2D6 inhibitor per R17.

**R42:** THE SYSTEM SHALL NOT compute CYP2C19 phenoconversion, as no CPIC-stated rule exists for this gene.

**R43:** THE SYSTEM SHALL assume steady-state conditions for all inhibitors AND SHALL NOT model inhibitor onset or washout timing.

---

**End of Requirements**

Every alert card in the RxGene UI displays the requirement number(s) that triggered it.
