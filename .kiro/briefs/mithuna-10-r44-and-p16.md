Model: claude-sonnet-4.5. Ananya's latest science review (commit 417ad29) added fixture P25 and requirement R44, and reworded P16. Engine only, and the fixtures win. 2 fixture cases fail; make them pass.

1. P16 (atomoxetine + a moderate inhibitor): the GREY text must match the fixture exactly, with the inhibitor's name inserted and capitalized:
   "Not assessed: {Inhibitor} is a moderate CYP2D6 inhibitor. RxGene does not have a validated phenoconversion adjustment for atomoxetine with moderate inhibitors. The genotype-based result remains available, but the medication-adjusted phenotype has not been determined. Pharmacist review recommended."
   Put this template in web/src/engine/messages.ts with the other fixed strings.
2. P25 / R44 (read R44 in .kiro/specs/rxgene-engine/requirements.md): for atomoxetine, when the genotype activity score is exactly 1.0 AND the CYP2D6 diplotype contains a *10 allele (*10, *10xN, or a *36 combination that contains *10), use CPIC's '1.0 (*10 allele present)' adult row. That's the titration text with a plasma-concentration check, the same as AS 0.25-0.75, so the alert is YELLOW. Check data/cpic/recommendations/atomoxetine.json for a row keyed for *10; if none exists, reuse the 0.75 row's text and cite R44. Without *10, AS 1.0 keeps the standard row (P15 stays GREEN).
3. Include R44 in the alert's requirement IDs (R39).

Run `npx tsc -b`, `npm test` and `npm run build`. All must pass, and all 25 fixtures must be green. Don't run git. List the files you changed.
