Four small fixes in `web/src/ui/mapAssessment.ts` found in the live preview walkthrough of brief 20. Pure mapping only; no clinical decision changes. Don't touch RxGeneUI.tsx.

1. **Marcus (already slow + strong inhibitor):** the caption says "No CYP2D6 inhibitor changes this result" while the scene shows fluoxetine as a strong inhibitor. In `captionFor`, when `alreadySlowInhibitor(a)` (from lib/verdict.ts) returns a drug, the caption is: `${Capitalized drug} adds no further effect: ${patientName} was already slow by genes.` Check this branch before the generic "No inhibitor" sentence.
2. **Lena (reverse case):** `drugLabel` shows the added drug (Fluoxetine) as the particle entering the enzyme, but the primary assessment is codeine. Set `drugLabel` to `capitalize(primary.drug)`, the drug whose response the scene shows.
3. **Jordan (atomoxetine label phenotype):** the score line renders "Activity score 2.0 →" with nothing after the arrow. For the label phenotype, return `scoreBefore: null, scoreAfter: null` and keep `scoreNote` = the label phenotype text.
4. **Priya (GREEN):** the headline is `GREEN_ALERT_TEXT` ("No supported PGx alert (not the same as safe)") and the qualifier repeats "(not the same as safe)", so it shows twice. Headline = `GREEN_ALERT_TEXT` with the trailing " (not the same as safe)" removed (derive it from the constant, don't retype the text); qualifier stays "(not the same as safe)".

Tests in `mapAssessment.test.ts`: Marcus caption contains "adds no further effect"; Lena drugLabel is "Codeine"; Jordan scoreBefore and scoreAfter are null and scoreNote is the label text; Priya headline does not contain "safe" and qualifier is "(not the same as safe)". Keep the existing never-"safe" test passing.

Done means the files compile and the tests are written. Don't run git. List the files you changed.
