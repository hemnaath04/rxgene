Owner: Ananya. Start now; aim to finish by 5:00 PM. Three tasks, in this order.

Why: the official rules (Rules & Project Submittal doc) score "Implementation" on how widely and deeply we used Kiro, and the Kiro write-up must address **property-based testing**, **MCP**, which **Kiro tools** we used (IDE/CLI/Web/Crew), Powers and more. "Insufficient use of Kiro will result in disqualification." We've only used the CLI, with no PBT and no MCP. These tasks close that gap. The rules also forbid third-party trademarks in the demo video.

Commit only the files each task names. Run `git pull --rebase origin dev` before every push, because Mithuna is pushing too.

## 1. Trademark cleanup (Kiro CLI or IDE, model claude-haiku-4.5, about 15 min)
Brand names appear in shipped text: "STRATTERA" (5×) and "PLAVIX" (1×) in `web/src/engine/fixedTexts.ts`, and the same strings in `tests/fixtures/expected_outputs.json`.
- Replace them with generic wording: "FDA atomoxetine label (section 2.5)" and "FDA clopidogrel label". Keep every quoted label sentence otherwise verbatim.
- The fixture file is protected from Kiro by the clinical-data hook (brief 14). So have Kiro edit `fixedTexts.ts`, then regenerate or edit the fixtures yourself (`python3 scripts/make_expected.py tests/fixtures/expected_outputs`, or hand-edit if those rows are curated), and run `cd web && npm test`. All tests must pass.
- In `docs/PLAN-v3.md` and `docs/SCIENCE.md`, replace "Prozac" with "fluoxetine (an antidepressant)".
- Check with: `grep -rniE "prozac|plavix|strattera" web/src web/api tests docs` returns nothing.

## 2. Property-based testing in the **Kiro IDE** (about 40 min)
Use the Kiro **IDE** for this task, so we can truthfully say we used both the IDE and the CLI. Docs: https://kiro.dev/docs/specs/correctness/ and https://kiro.dev/blog/property-based-testing/.
- Open `.kiro/specs/rxgene-engine/` in the IDE and ask Kiro to extract testable properties from the EARS requirements and generate property-based tests for the engine. Let Kiro choose the TypeScript PBT library; fast-check is the likely one, installed as `npm i -D fast-check` in web/. The tests go in `web/src/engine/properties.test.ts` (test file only; don't change engine code).
- At minimum, these properties, each tagged with its requirement:
  1. **R33:** for any preset patient × any covered drug × any subset of inhibitors on the list, no output text (recommendation, notes, CDS card summary and detail) contains "safe" except in "not the same as safe".
  2. **R10/R11/R13:** for any genotype and inhibitor set, adjustedActivityScore ≤ genotypeActivityScore. A strong inhibitor always gives 0; moderate alone gives exactly × 0.5; with several, the strongest wins.
  3. **R3–R6:** the phenotype is monotonic in the activity score. A higher score never gives a "slower" phenotype.
  4. **R7/R8:** any unknown allele or a missing CYP2D6 gives GREY, never GREEN.
  5. **R21:** genotype AS 0 plus any inhibitor still gives the drug-level alert (never GREEN) and includes the "adds no further effect" note.
  6. **R54 (once brief 12 lands):** checkOrder output is identical before and after running the consult agent with a mocked LLM.
- Run `cd web && npm test`. If PBT finds a real counterexample, **don't change the test to pass**. Write the counterexample into `.kiro/specs/rxgene-engine/analysis.md` and tell Hemnaath, so Mithuna gets a fix brief. Any bug PBT catches is a strong line in the Kiro write-up.
- Commit: `web/src/engine/properties.test.ts`, `web/package.json` and `web/package-lock.json` (if fast-check was added), and `analysis.md`.

## 3. MCP: one genuine use (about 20 min)
Docs: https://kiro.dev/docs/mcp/configuration/. Kiro reads `.kiro/settings/mcp.json`, the same file for the IDE and the CLI.
- Add a fetch server:
  ```json
  { "mcpServers": { "fetch": { "command": "uvx", "args": ["mcp-server-fetch"] } } }
  ```
  You need `uv` installed (`brew install uv`). If uvx isn't possible on your laptop, pick any documented fetch or PubMed MCP server that works, and note which one.
- **Real use:** in Kiro, use the MCP fetch tool to re-verify the sources behind 3 claims:
  - the CPIC opioid phenoconversion sentence (PMC8249478)
  - the Cicali 2021 "20–30%" sentence (PMC8404400)
  - one openFDA count from `data/openfda/pair_reports.json`, re-queried live
  Record the result of each (matches / differs) in `docs/SCIENCE.md` under "Verified via Kiro MCP (fetch)", with the date.
- Commit: `.kiro/settings/mcp.json` and `docs/SCIENCE.md`.

Afterward, send Hemnaath three sentences, one per task, about what happened and what (if anything) surprised you. They go into KIRO.md.
