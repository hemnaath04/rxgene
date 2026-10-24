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

**R7:** WHEN a patient's CYP2D6 genotype is not exactly two parseable alleles (one allele, three or more alleles, malformed notation, an unparseable copy number, or a duplication of an unknown allele) OR contains one or more alleles with no activity value (an allele absent from the reference data, or with a null activity value), THE SYSTEM SHALL assign the status "Indeterminate" (a status, not a metabolizer phenotype) AND SHALL issue a GREY-level alert AND SHALL NOT default to normal metabolizer AND SHALL NOT treat an unknown allele as normal function AND SHALL NOT calculate a partial activity score from the interpretable allele alone (for example from *1 only) AND SHALL NOT assign any CYP2D6 metabolizer phenotype when an allele cannot be interpreted AND SHALL NOT display a drug-specific CPIC dosing recommendation (for example for codeine) for the indeterminate result AND SHALL show this exact fixed text on the card: "Indeterminate: this gene result includes a variant we cannot interpret, so no pharmacogenomic check was done for this drug. Ask a pharmacist."

**R8:** WHEN a patient's CYP2D6 gene result is missing or not provided, THE SYSTEM SHALL assign the status "Insufficient data" AND SHALL issue a GREY-level alert AND SHALL show this exact fixed text on the card: "Insufficient data: there is no CYP2D6 result on file, so no pharmacogenomic check was done for this drug."

Indeterminate (R7), Insufficient data (R8) and Not assessed (R18, R32) are three distinct states.

---

## Phenoconversion: Inhibitor Adjustment

**R9:** WHEN checking a drug for CYP2D6 phenoconversion, THE SYSTEM SHALL exclude that drug itself from the list of inhibitors considered, so a drug never phenoconverts its own recommendation.

**R10:** WHEN computing phenoconversion for codeine or tramadol AND a patient takes one or more CYP2D6 inhibitors (excluding the drug being assessed) AND the strongest inhibitor is classified as "strong", THE SYSTEM SHALL set the adjusted activity score to 0.

**R11:** WHEN computing phenoconversion for codeine or tramadol AND a patient takes one or more CYP2D6 inhibitors (excluding the drug being assessed) AND the strongest inhibitor is classified as "moderate" AND no strong inhibitor is present, THE SYSTEM SHALL multiply the genotype activity score by 0.5 to compute the adjusted activity score.

**R12:** WHEN computing phenoconversion for codeine or tramadol AND a patient takes one or more CYP2D6 inhibitors (excluding the drug being assessed) AND the strongest inhibitor is classified as "weak" AND no strong or moderate inhibitor is present, THE SYSTEM SHALL use the genotype activity score as the adjusted activity score without modification AND SHALL include a note that weak inhibitors were present.

**R13:** WHEN multiple CYP2D6 inhibitors are present on the medication list (excluding the drug being assessed), THE SYSTEM SHALL apply only the adjustment of the strongest class present AND an inhibitor not listed in `inhibitors.json` SHALL NOT be treated as an inhibitor.

**R14:** WHEN an adjusted activity score has been computed for codeine or tramadol due to an inhibitor, THE SYSTEM SHALL map the adjusted score to an adjusted phenotype using the thresholds in R3–R6.

**R15:** WHEN computing phenoconversion for codeine, THE SYSTEM SHALL apply the inhibitor adjustment rules (R10–R14).

**R16:** WHEN computing phenoconversion for tramadol, THE SYSTEM SHALL apply the inhibitor adjustment rules (R10–R14).

**R17:** WHEN computing phenoconversion for atomoxetine AND a strong CYP2D6 inhibitor is present (excluding atomoxetine itself), THE SYSTEM SHALL lead the alert card with the FDA STRATTERA label section 2.5 (adult taking a strong CYP2D6 inhibitor; a longer 4-week titration interval, with its conditions: if ADHD symptoms fail to improve and the initial dosage is well tolerated; starting, target and maximum dosages as in the label's standard adult table) AND SHALL show the CPIC atomoxetine 2019 poor-metabolizer recommendation only as supporting genotype-based context, not as an equally applicable dosing instruction AND SHALL show this fixed text: "Different guidance contexts: FDA labeling directly addresses strong CYP2D6 inhibitor coadministration and recommends a 4-week titration interval. CPIC 2019 provides genotype-based poor-metabolizer guidance with a 2-week response assessment. These recommendations should not be treated as interchangeable." AND SHALL show the adjusted activity score as "n/a" and the phenotype description "Poor-metabolizer-equivalent dosing (FDA label)" AND SHALL NOT apply the ×0 / ×0.5 multiplier AND SHALL keep the adult population label, source links and guideline versions visible.

**R18:** WHEN computing phenoconversion for atomoxetine AND a moderate CYP2D6 inhibitor is present (excluding atomoxetine itself) AND no strong inhibitor is present, THE SYSTEM SHALL assign the status "Not assessed" AND SHALL issue a GREY-level alert AND SHALL NOT compute an adjusted activity score AND SHALL show this fixed text template on the card, where {Inhibitor} is the name of the moderate inhibitor on the medication list (WHEN several moderate inhibitors are present, the text SHALL name all of them): "Not assessed: {Inhibitor} is a moderate CYP2D6 inhibitor. RxGene does not have a validated phenoconversion adjustment for atomoxetine with moderate inhibitors. The genotype-based result remains available, but the medication-adjusted phenotype has not been determined. Pharmacist review recommended." AND the text SHALL NOT say that CPIC states no adjustment. Atomoxetine with only weak inhibitors present receives no adjustment and is handled by genotype (R26).

**R19:** WHEN assessing any CYP2D6 drug, THE SYSTEM SHALL ALWAYS emit both the genotype phenotype and the adjusted (converted) phenotype AND SHALL ALWAYS display them side by side in the alert details, even when no phenoconversion occurred (for example a patient who is already a poor metabolizer by genotype, or a patient with no inhibitor present); WHEN no inhibitor is present, the adjusted phenotype SHALL equal the genotype phenotype. Exceptions: for R7, R8 and R18 no adjusted phenotype is emitted (the R7, R8 or R18 text is shown instead); for R17 the adjusted phenotype is the R17 description.

---

## Edge Cases: Confidence and Interaction Notes

**R20:** WHEN assessing codeine or tramadol AND a patient's genotype phenotype is "Ultrarapid Metabolizer" AND a strong CYP2D6 inhibitor is present, THE SYSTEM SHALL compute the adjusted phenotype per R10 and R14 AND SHALL flag the result with "reduced confidence" AND SHALL show BOTH the converted (adjusted phenotype) recommendation and the genotype (Ultrarapid Metabolizer) recommendation, together with the caveat that ultrarapid metabolizers may not phenoconvert completely; WHEN two recommendations are shown, the higher-severity alert level governs the card level AND both recommendations are displayed.

**R21:** WHEN a patient's genotype activity score is 0 (poor metabolizer by genotype) AND any CYP2D6 inhibitor is present, THE SYSTEM SHALL still issue the drug-level alert for that phenotype AND SHALL include an inhibitor note with this exact fixed text, which names the inhibitor: "{Inhibitor} adds no further effect: already a poor metabolizer by genotype. The drug-level alert still applies."

**R22:** WHEN an inhibitor drug is added to a patient's medication list, THE SYSTEM SHALL re-check every drug already on the medication list for CYP2D6-related alerts.

**R23:** Removed. (Meds are active-only, steady-state, no washout, see R43.)

---

## Recommendation Lookup and Alert Levels

**R24:** WHEN looking up a CPIC recommendation for codeine, THE SYSTEM SHALL look up the recommendation by PHENOTYPE (mapped from the genotype or adjusted activity score using R3–R6) AND SHALL NOT use an exact activity-score key, because adjusted scores such as 0.625 (1.25 × 0.5) have no row in the CPIC data; the CPIC codeine rows are labeled "general".

**R25:** WHEN looking up a CPIC recommendation for tramadol, THE SYSTEM SHALL look up the recommendation by PHENOTYPE (mapped from the genotype or adjusted activity score using R3–R6) AND SHALL NOT use an exact activity-score key, because adjusted scores such as 0.625 (1.25 × 0.5) have no row in the CPIC data; the CPIC tramadol rows are labeled "general".

**R26:** WHEN looking up a CPIC recommendation for atomoxetine, THE SYSTEM SHALL use the genotype activity score as the lookup key, taking the exact row for that activity score or, where the CPIC table gives a range, the row whose range contains it (WHEN no row matches, R30 and R32 apply), AND SHALL use the "adults" population, because atomoxetine recommendations differ inside the intermediate phenotype (activity score 1.0 differs from 0.25–0.75); moderate-inhibitor scores are never computed for atomoxetine (R18), so only quarter-step scores occur; the alert card SHALL state the population used (adults) for atomoxetine; the activity score 1.0 case with a *10 allele follows R44.

**R27:** WHEN looking up a CPIC recommendation for clopidogrel, THE SYSTEM SHALL use the CYP2C19 phenotype (mapped directly from diplotype, without activity score computation) AND SHALL use the "CVI ACS PCI" population.

**R28:** WHEN a patient taking clopidogrel is also taking omeprazole, THE SYSTEM SHALL include a separate label-level note for the omeprazole–clopidogrel interaction, whose fixed text is exactly "Label interaction: FDA PLAVIX label advises avoiding concomitant use of omeprazole or esomeprazole. Shown separately from the genotype result.", AND SHALL show that warning text on the alert card itself (not only a generic badge and not only in the evidence drawer), AND SHALL NOT compute CYP2C19 phenoconversion. The label text also names esomeprazole, which RxGene does not model; the note is triggered by omeprazole only.

**R29:** THE SYSTEM SHALL take the alert level (RED, YELLOW, GREEN or GREY) from the curated alertLevel field in `data/alert_levels.json` for the matched recommendation.

**R30:** THE SYSTEM SHALL NOT infer an alert level from the wording of the recommendation text (for example by checking whether it starts with 'Avoid'); WHEN no alertLevel entry exists for a matched recommendation, THE SYSTEM SHALL assign GREY and report a data error, and SHALL NOT default to GREEN.

**R31:** WHEN the matched `alert_levels.json` entry is GREEN, THE SYSTEM SHALL display the message "No supported PGx alert (not the same as safe)" AND the GREEN result SHALL be labeled on the card as the genotype result only, AND SHALL NOT be presented as an overall medication safety clearance (for example when an omeprazole label note is also shown with a GREEN clopidogrel result).

**R32:** WHEN no CPIC recommendation is available for a given drug–phenotype combination, OR the drug is one the engine does not compute or cover (for example atomoxetine with a moderate inhibitor), THE SYSTEM SHALL label the result "Not assessed"; WHEN the phenotype is "Indeterminate" it SHALL be labelled "Indeterminate", AND WHEN the status is "Insufficient data" it SHALL be labelled "Insufficient data"; these three states are separate and distinctly labelled, AND THE SYSTEM SHALL assign a GREY-level alert for each of them, and also WHEN no alertLevel entry exists for the matched recommendation; none of the three GREY texts (R7, R8, R18) may reuse any wording of the GREEN text "No supported PGx alert (not the same as safe)".

**R33:** THE SYSTEM SHALL NOT use the words safe, safely, safety, unsafe, seguro or seguridad in any displayed text, English or Spanish; the only exceptions are the exact strings 'not the same as safe' (R31) and 'no es lo mismo que seguro'. This applies to all text the system displays, including AI-written summaries (R35) and consult notes (R45–R56), whether agent-written or "Template".

**R44:** WHEN looking up an atomoxetine recommendation AND the genotype activity score is exactly 1.0 AND the CYP2D6 diplotype contains a *10 allele (*10, *10xN, or a *36 combination that contains *10), THE SYSTEM SHALL use the CPIC atomoxetine 2019 adult-dose table row '1.0 (*10 present)' (diplotype alleles are written as in the CPIC allele table, for example *10, *10x2, *36+*10; the titration text with a plasma-concentration check, the same text as activity scores 0.25 to 0.75, alert level YELLOW), AND WHEN the diplotype at activity score 1.0 does not contain a *10 allele THE SYSTEM SHALL use the standard 1.0 row ('1.0 (*10 allele not present)'); the card SHALL keep CPIC's 'controversy remains' note visible in the evidence drawer for activity score 1.0; the data source for this rule is the CPIC PDF because the CPIC API returns only the 'not present' row.

---

## AI Component Safety

**R34:** THE SYSTEM SHALL NOT allow the AI component to decide whether an alert appears, what alert level is assigned, or what CPIC recommendation is selected.

**R35:** WHEN the AI component generates a plain-language summary, THE SYSTEM SHALL validate that the summary: contains the correct drug name; preserves the alert action (RED says avoid; YELLOW names the dose or titration pathway and never says avoid; GREY says not assessed or pharmacist review; GREEN says no supported alert, genotype result only); keeps every dose in the recommendation; contains no unsafe wording (R33); names no drug not in the input; contains no number not in the input (identifiers and verbatim fixed texts are exempt from the number rule); and is 90 words or fewer.

**R36:** WHEN the AI summary fails for any reason (timeout after 6 seconds, HTTP error, empty reply, missing key, or validation failure), THE SYSTEM SHALL display a fixed template summary instead AND SHALL label it "Template".

**R37:** WHEN the AI-generated summary passes validation, THE SYSTEM SHALL label it "AI-written from rule output".

---

## Evidence and Traceability

**R38:** WHEN issuing an alert that carries a recommendation (any alert other than GREY), THE SYSTEM SHALL:
- (a) include the guideline name, guideline URL and data fetch date;
- (b) include the evidence strength classification, except that for an FDA-label-led alert (R17) the card SHALL show the label source in place of a CPIC strength;
- (c) show the recommendation text verbatim and in full in the evidence drawer, keeping every condition in it;
- (d) show recommendation wording exactly as CPIC states it, because the wording differs by phenotype;
- (e) NOT shorten or paraphrase the recommendation; and
- (f) show alternative drugs only inside the quoted CPIC or FDA recommendation text.

**R39:** WHEN issuing any alert, THE SYSTEM SHALL identify which numbered requirement (R1–R56, excluding the removed R23) triggered the alert so the clinician can trace the decision path.

**R40:** WHEN any atomoxetine assessment is displayed, THE SYSTEM SHALL display a note that the current standardized thresholds are used and the older convention differs.

---

## Scope and Limitations

**R41:** THE SYSTEM SHALL apply multiplier-based phenoconversion (strong inhibitor ×0, moderate inhibitor ×0.5) only to codeine and tramadol, per CPIC opioids 2021; atomoxetine with a strong inhibitor follows the label-based rule in R17 with no multiplier.

**R42:** THE SYSTEM SHALL NOT compute CYP2C19 phenoconversion, because no CPIC-stated adjustment rule for this gene was identified in the sources checked; FDA lists fluoxetine as a strong CYP2C19 inhibitor, so CYP2C19 phenoconversion is a known limitation that the README states.

**R43:** THE SYSTEM SHALL assume steady-state conditions for all inhibitors AND SHALL NOT model inhibitor onset or washout timing.

---

## Consult Agent

The consult agent automates the manual phenoconversion consult note a PGx pharmacist writes into the chart (PLAN-v3). The rule engine still decides everything; the agent only gathers tool results and writes them up (R34 applies to the agent).

**R45:** WHEN the pharmacist requests a medication-list review, THE SYSTEM SHALL run the consult agent over every medication on the patient's list, plus the drug being added if there is one.

**R46:** THE consult agent SHALL obtain clinical facts only by calling deterministic tools (get_patient, check_drug, list_inhibitors, get_evidence). check_drug SHALL return the rule engine's assessment unchanged. THE SYSTEM SHALL NOT give the agent any tool that creates, changes or suppresses an alert.

**R47:** WHEN the consult note states a recommendation, alert level, phenotype, diplotype, activity score, inhibitor class or qualifier (reduced confidence, inhibitor note, label note, population), THE SYSTEM SHALL require that sentence to cite at least one tool call from the same run. A sentence that states such a fact without a valid citation SHALL fail validation. A citation is valid only if it refers to a tool call from the same run AND that call's result contains the fact stated. Citations SHALL be checked by deterministic code, not by a model; the deterministic check matches structured claims against tool results.

**R48:** THE consult note SHALL address every drug the engine assessed as RED or YELLOW, keeping the engine's action for that drug ("avoid" for RED; a dose or titration adjustment for YELLOW).

**R49:** THE consult note SHALL NOT name any drug that is not on the medication list, is not the drug being added, and does not appear in a returned CPIC or FDA recommendation text; alternative drugs may appear only inside quoted CPIC or FDA recommendation text.

**R50:** THE consult note SHALL NOT contain any number that does not appear in a tool result from the same run. The following are exempt from this rule: counts of medications reviewed, timestamps in the note header, trace step indices (citation markers), gene and allele identifiers, requirement identifiers (for example CYP2D6, *4, R10), and fixed texts taken verbatim from tool output.

**R51:** WHEN the note fails validation (R33, R47–R50, R55–R56), OR the model call fails, OR the agent exceeds 8 tool-call rounds, OR the run exceeds 25 seconds, THE SYSTEM SHALL show a deterministic consult note built directly from the engine's assessments, labeled "Template". A round is one model turn that requests tool calls (parallel calls in one turn count as one round). The Template note contains no model text, so R47, R49 and R50 do not apply to it; R33, R48, R52, R53, R55 and R56 do.

**R52:** THE SYSTEM SHALL label every consult note "Draft — pharmacist review required" and SHALL NOT offer any action that sends, signs or files the note.

**R53:** THE SYSTEM SHALL display the agent's tool-call trace (tool name, arguments, short result) next to the note, and each citation SHALL link to the trace step it cites. The trace SHALL also be shown when the run fell back to the Template note (R51), up to the point of failure.

**R54:** THE consult agent SHALL NOT change, suppress or reorder the engine's alerts. THE alerts shown in the main view SHALL be identical whether or not the agent has run.

**R55:** THE consult note SHALL list every medication reviewed (R45) together with the engine's result for it, AND a medication with no check_drug result from the same run SHALL fail validation. WHEN the engine's result is GREY, THE note SHALL state the matching fixed text of R7, R8 or R18 unchanged AND SHALL NOT omit the drug. WHEN the engine's result is GREEN, THE note SHALL use the wording "No supported PGx alert (not the same as safe)", SHALL label it a genotype result only (R31), AND SHALL NOT state or imply that the medication list as a whole has been cleared.

**R56:** WHEN the engine's result for a drug carries a qualifier, THE consult note SHALL keep it: the genotype phenotype and the adjusted phenotype side by side (R19); the "reduced confidence" flag with both recommendations (R20); the inhibitor note for a patient who is already a poor metabolizer (R21); the FDA/CPIC "Different guidance contexts" text for atomoxetine (R17); the omeprazole–clopidogrel label note (R28); and the population used for atomoxetine and clopidogrel (R26, R27).

---

**End of Requirements**
