Read .plans/rxgene-build-spec.md sections 3, 4 and 8, .kiro/steering/clinical-rules.md, data/README.md, and tests/fixtures/expected_outputs.json.

Task: build only the rule engine and its tests. No UI yet.
1. The app in web/ is already scaffolded and configured (see .plans/rxgene-architecture-spec.md). Data is copied into web/src/data/ by `npm run sync-data`, so import from '@/data/...'. Don't re-scaffold it or change the config.
2. Create web/src/engine/ as pure TypeScript, with no fetch calls and no React. Implement checkOrder(patient, addedDrug) and toCdsCard(assessment), using the exact types in spec section 4. Read allele values, recommendations and inhibitors by statically importing the JSON in web/src/data/.
3. Write web/src/engine/fixtures.test.ts. It must run every case in tests/fixtures/expected_outputs.json and check alert, genotype_phenotype, adjusted_phenotype, cpic_recommendation (exact match), confidence and inhibitor_note.
4. Create a Kiro hook that runs `npx vitest run` whenever web/src/engine/** is saved.

Rules: never hardcode allele values or recommendation text. Always read them from data/. Never output the word "safe". Don't run git. When you finish, list the files you created.
