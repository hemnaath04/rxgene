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
- Atomoxetine + strong inhibitor (R17): **no multiplier**; the adjusted score is null ("n/a") and
  the adjusted phenotype is "Poor-metabolizer-equivalent dosing (FDA label)". Lead with the FDA
  STRATTERA label section 2.5 text, show the CPIC 2019 poor-metabolizer text only as supporting
  context, and show the fixed "Different guidance contexts" flag. Atomoxetine + moderate
  inhibitor (R18): do **not** compute; GREY "Not assessed" with the R18 fixed text.
- UM + strong inhibitor on codeine/tramadol (R20): reduced confidence, and show **both** the
  converted and the genotype (UM) recommendation, with the caveat that UMs may not fully phenoconvert.
- Show the genotype phenotype and the adjusted phenotype **side by side**.

## Lookups
- Codeine and tramadol recommendations are keyed by **phenotype** (R24, R25): map the genotype or
  adjusted activity score to a phenotype first. Adjusted scores like 0.625 have no score row.
- Atomoxetine stays keyed by **activity score** (R26), because its text differs inside the
  intermediate range. Atomoxetine at AS exactly 1.0 (R44): with a `*10` allele (`*10`, `*10xN`, or a
  `*36` combination containing `*10`) use the `alert_levels.json` entry "1.0 (*10 present)", which
  points to the 0.75 titration row (YELLOW); without `*10`, use the standard 1.0 row (GREEN).
- Atomoxetine: use the `adults` population.
- Clopidogrel: CYP2C19 diplotype -> phenotype directly (no activity score). Use the `CVI ACS PCI` population.
- Omeprazole + clopidogrel is a separate label-level note. It is not a computed phenoconversion.

## Alert levels (R29, R30)
- Read the level from `data/alert_levels.json` for the matched recommendation. **Never infer it
  from the text** (no "starts with Avoid" checks).
- No entry for the matched recommendation = GREY plus a data error. Never default to GREEN.
- GREEN text: "No supported PGx alert (not the same as safe)". Never call anything "safe".
- GREY has three separate states with fixed texts: Indeterminate (R7), Insufficient data (R8),
  Not assessed (R18/R32). None of them reuses the GREEN wording.
