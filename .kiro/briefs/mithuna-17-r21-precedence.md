Model: claude-sonnet-4.5. Run right AFTER brief 16 (agent timeouts). About 15 min. Run Kiro with `--agent rxgene` so the guards are active.

Two engine bugs, both caught by Ananya's property-based tests (web/src/engine/properties.test.ts) and recorded in .kiro/specs/rxgene-engine/analysis.md. Fixture P26 encodes her decision (spec commit 7953d82: "R18 defers to R21 for genotype poor metabolizers"). Change the engine only; the tests and fixtures are correct and must not be edited.

1. **R18 hides R21 (finding #1).** A genotype poor metabolizer (AS 0) taking atomoxetine plus a MODERATE inhibitor currently gets GREY "Not assessed" with no note. PBT counterexample: `["*100/*100", ["abiraterone"], "atomoxetine"]`; fixture P26: `*4/*4` + duloxetine, adding atomoxetine.
   Expected (P26): alert YELLOW, genotype and adjusted phenotype both "Poor Metabolizer", the CPIC atomoxetine adults AS 0.0 recommendation verbatim, inhibitorNote = "duloxetine adds no further effect: already a poor metabolizer by genotype. The drug-level alert still applies." (use the inhibitor's name).
   Rule: check R21 BEFORE R18. R18's "Not assessed" applies only when the genotype is NOT already a poor metabolizer.
2. **R17 skips the R21 note (second gap).** `*4/*4` + fluoxetine (strong) + atomoxetine gives the correct YELLOW but NO "adds no further effect" note. Rule: whenever genotype AS is 0 and any inhibitor is present, add the R21 note for every drug (codeine, tramadol, atomoxetine), whichever rule (R10, R17 or R18) produced the alert.
3. Run `npx vitest run`. **All tests must pass**, including P26 and the property test "R21 AS 0 genotype + any inhibitor". Then `npx tsc -b` and `npm run build`.

Don't run git. List the files you changed.
