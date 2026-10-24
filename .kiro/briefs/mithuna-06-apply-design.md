Model: auto. Read docs/DESIGN.md (from the frontend designer), .plans/rxgene-build-spec.md section 7, and docs/PLAN-v3.md ("UI language" and the 60-90 s demo script).

Task: apply the design to the existing components. Don't change the engine, the API or the data flow.

1. Put the design tokens in web/src/index.css as CSS variables used by the Tailwind theme (@theme). Alert-level colors must also carry an icon and a label, never color alone.
2. Gauge: a single Slow / Reduced / Normal / Fast scale with a hollow marker ("by genes") and a solid marker ("right now"). Animate them apart with motion/react (a spring of about 600 ms) when an inhibitor changes the phenotype. Respect prefers-reduced-motion. Map Poor to Slow, Intermediate to Reduced, Normal to Normal and Ultrarapid to Fast. For Indeterminate or Insufficient data, show no marker and "Not assessed".
3. EvidenceDrawer (shadcn Sheet): diplotype, activity score before and after, both phenotypes, the inhibitor and its FDA class, the CPIC recommendation verbatim, the strength, the guideline link and fetched date, the old-atomoxetine-thresholds note (R40), the triggering requirement IDs (R39), and the raw CDS card JSON.
4. ComparisonStrip, shown for phenoconverted cards: "Gene report alone" / "Typical interaction warning (illustrative)" / "RxGene".
5. Cards enter and leave with AnimatePresence.
6. Check every beat of the 60-90 s demo script against the screen, and list anything the design doesn't cover.

Never show the word "safe" except in "not the same as safe". Don't run git. List the files you changed.
