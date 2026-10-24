# Clinical rules (verified 2026-10-24; do not change without a source)

## CYP2D6 activity score -> phenotype (current CPIC standard, CPIC 2023 Table 1)
- AS = sum of the two allele activity values from `data/cpic/cyp2d6_alleles.json`.
- For duplications (`*1x2`), multiply the allele value by the copy number.
- 0 = Poor; 0 < AS < 1.25 = Intermediate; 1.25 <= AS <= 2.25 = Normal; > 2.25 = Ultrarapid.
- If an allele has no activity value, or the result is missing, the phenotype is
  **Indeterminate / Not assessed**. Never default to normal.

## Phenoconversion (CPIC opioids 2021, Crews et al., PMC8249478)
- Strong CYP2D6 inhibitor -> AS = 0 (poor metabolizer). Moderate -> AS x 0.5, then re-map.
- **Apply this only to codeine and tramadol.** CPIC 2023 antidepressants says no consensus
  method exists, so don't generalize.
- Atomoxetine + strong inhibitor: use the poor-metabolizer recommendation, citing the FDA
  label and CPIC atomoxetine 2019. Atomoxetine + moderate inhibitor: do **not** compute;
  show "pharmacist review".
- UM + paroxetine: still show the result, plus a caveat that UMs may not phenoconvert (CPIC 2023).
- Fluoxetine stopped < 3 months ago counts as active.
- Show the genotype phenotype and the adjusted phenotype **side by side**.

## Lookups
- Codeine, tramadol and atomoxetine recommendations are keyed by **activity score**, not
  phenotype label. (Atomoxetine at AS 1.0 = the NM recommendation.)
- Atomoxetine: use the `adults` population.
- Clopidogrel: CYP2C19 diplotype -> phenotype directly (no activity score). Use the `CVI ACS PCI` population.
- Omeprazole + clopidogrel is a separate label-level note. It is not a computed phenoconversion.

## Alert levels
- RED: the recommendation starts with "Avoid".
- YELLOW: a dose or titration change, or "if no response, consider…".
- GREEN: "No supported PGx alert". Never label it "safe".
- GREY: Not assessed / Insufficient data / No recommendation.
