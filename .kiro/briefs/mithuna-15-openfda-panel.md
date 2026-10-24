Model: claude-haiku-4.5. **REQUIRED** (no longer optional): the official judging criteria reward "finding and using unique public resources like datasets" under Quality and Design. Run it after brief 14 and BEFORE brief 12, so it ships even if the agent runs late. About 20 min.

Context: the organizers' Healthcare & Biotech data portal (https://hackachusetts2026.vercel.app/#/healthcare) lists the **openFDA drug adverse events API**. The lead saved report counts for our demo drug pairs in `data/openfda/pair_reports.json` (fetched 2026-10-24, from `scripts/fetch_openfda.py`). Example: 609 FAERS reports list both codeine and fluoxetine; 92 are coded "DRUG INTERACTION" and 55 "DRUG INEFFECTIVE".

Goal: a small **"Real-world reports (openFDA)"** panel in the Evidence sheet. It's context only, so it must stay subordinate to the CPIC evidence.

1. Data: extend `web/scripts/sync-data.mjs` to also copy `../data/openfda/` to `src/data/openfda/`, and gitignore the copy. Do NOT edit `data/openfda/pair_reports.json`; it's a snapshot. Read it with a static JSON import (`with { type: 'json' }` if any server code imports it).
2. A UI-only lookup in `web/src/lib/openfda.ts`: `reportsFor(drug, coMedications)` returns the matching pair rows (drug = the assessed drug; coMedication = any drug on the list), or none.
3. Panel in `EvidenceSheet`, placed BELOW the CPIC/FDA evidence:
   - Title: "Real-world reports (openFDA FAERS)".
   - One line per matching pair: "{totalReports} reports list both {drug} and {coMedication}. {DRUG INTERACTION} were coded 'drug interaction' and {DRUG INEFFECTIVE} 'drug ineffective'."
   - Always show the snapshot's `caveat` text verbatim, plus "Fetched {fetched}" and a link to the pair's `query` URL.
   - No matching pair: show nothing. Don't render "0 reports".
4. Hard rules:
   - The engine (`web/src/engine/**`), CDS cards, the summary API and the consult agent must NOT read this data. It never changes an alert, a phenotype or a recommendation.
   - Never rank, compare or color pairs by count. Never write "proves", "causes" or "confirms". Report counts don't measure interaction strength: codeine+sertraline, a weak inhibitor with no CPIC adjustment, has as many interaction reports as codeine+fluoxetine.
   - Never use the word "safe".
5. A test (Vitest): Sarah (fluoxetine, adding codeine) gets the codeine+fluoxetine row; Priya (no meds) gets none; checkOrder output is identical whether or not openfda data is loaded.

Run `npx tsc -b`, `npm test` and `npm run build`. Don't run git. List the files you changed.
