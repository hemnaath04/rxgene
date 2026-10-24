Read .plans/rxgene-build-spec.md sections 3, 4 and 8, .kiro/steering/clinical-rules.md, data/README.md, and tests/fixtures/expected_outputs.json.

Task: build only the rule engine and its tests. No UI yet.
1. The Vite + React + TypeScript app in web/ is already scaffolded, with Vitest installed. Don't re-scaffold it.
2. Create web/src/engine/ as pure TypeScript, with no fetch calls and no React. Implement checkOrder(patient, addedDrug) and toCdsCard(assessment), using the exact types in spec section 4. Read allele values, recommendations and inhibitors from the JSON files in data/ (import them, or copy them into web/src/data at build time).
3. Write web/src/engine/fixtures.test.ts. It must run every case in tests/fixtures/expected_outputs.json and check alert, genotype_phenotype, adjusted_phenotype, cpic_recommendation (exact match), confidence and inhibitor_note.
4. Create a Kiro hook that runs `npx vitest run` whenever web/src/engine/** is saved.

Rules: never hardcode allele values or recommendation text. Always read them from data/. Never output the word "safe". Don't run git. When you finish, list the files you created.
