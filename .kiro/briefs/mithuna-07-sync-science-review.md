Model: claude-sonnet-4.5. Ananya's science review updated tests/fixtures/expected_outputs.json (now 24 cases) and docs/SCIENCE.md. The fixtures are the source of truth: change the engine, never the fixtures.

Read docs/SCIENCE.md, .kiro/steering/clinical-rules.md and tests/fixtures/expected_outputs.json. Then run `cd web && npx vitest run src/engine/fixtures.test.ts` and make the engine (web/src/engine/) match these 5 failing cases:

1. P06 (UM + strong inhibitor): emit inhibitorNote exactly as in the fixture ("Caveat: CPIC 2023 notes ultrarapid metabolizers may not phenoconvert with paroxetine. Both recommendations are shown (converted and genotype); both say avoid codeine."). Keep confidence 'reduced'.
2. P13 (atomoxetine + strong inhibitor): adjustedPhenotype must be the exact fixture string "Poor-metabolizer-equivalent dosing (FDA label)". Don't relabel it "Poor Metabolizer".
3. P16 (atomoxetine + moderate inhibitor): use the fixture's recommendation text verbatim.
4. P20 (unknown allele): use the fixture's "Indeterminate: …" text verbatim.
5. P21 (no CYP2D6 result): use the fixture's "Insufficient data: …" text verbatim.

Put the fixed GREY and not-computed strings in one constants module (web/src/engine/messages.ts) so the UI, CDS cards and templates read the same text. Check that the UI components (VerdictBar, StoryRow, Gauge) don't hard-match the old strings. Don't run git. Finish when all 24 fixture cases and every other test pass, and list the files you changed.
