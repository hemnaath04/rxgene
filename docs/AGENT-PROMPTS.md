# Agent prompts: copy and paste these

**Before you paste anything:**
1. Clone the repo: `git clone https://github.com/hemnaath04/rxgene && cd rxgene`
2. Switch to the dev branch and turn on the push guard:
   `git switch dev && git config core.hooksPath .githooks`
3. Open the `rxgene` folder in Kiro (IDE or `kiro-cli`). Kiro loads `.kiro/steering/`
   automatically, so you don't need to paste the clinical rules.

Where things are:
- [Who does what](TEAM-SPLIT.md)
- [Build spec](../.plans/rxgene-build-spec.md): source of truth
- [Plan v3](PLAN-v3.md)
- [Clinical rules](../.kiro/steering/clinical-rules.md)

---

## Mithuna → Kiro

### Task 1: engine and tests (model `claude-sonnet-4.5`, start at 11:30)

```
Read .plans/rxgene-build-spec.md sections 3, 4 and 8, .kiro/steering/clinical-rules.md, data/README.md, and tests/fixtures/expected_outputs.json.

Task: build only the rule engine and its tests. No UI yet.
1. Scaffold a Vite + React + TypeScript app in web/ (the folder only holds .gitkeep; ignore it). Add Vitest.
2. Create web/src/engine/ as pure TypeScript, with no fetch calls and no React. Implement checkOrder(patient, addedDrug) and toCdsCard(assessment), using the exact types in spec section 4. Read allele values, recommendations and inhibitors from the JSON files in data/ (import them, or copy them into web/src/data at build time).
3. Write web/src/engine/fixtures.test.ts. It must run every case in tests/fixtures/expected_outputs.json and check alert, genotype_phenotype, adjusted_phenotype, cpic_recommendation (exact match), confidence and inhibitor_note.
4. Create a Kiro hook that runs `npx vitest run` whenever web/src/engine/** is saved.

Rules: never hardcode allele values or recommendation text. Always read them from data/. Never output the word "safe". Run the tests and show me the pass/fail count. Commit to the dev branch only.
```

### Task 2: plain UI (model `auto`, after Task 1 passes)

```
Read .plans/rxgene-build-spec.md section 7.

Build a plain, functional UI in web/src/components/. No styling work yet, because a design arrives later.
- PatientPicker using the 8 preset patients from the spec section 7 table. Put them in web/src/data/patients.ts.
- MedList with add/remove, and a search box over: the drugs in data/cpic/recommendations, every drug in data/inhibitors.json, and acetaminophen and ibuprofen (uncovered drugs, which should show GREY).
- One AlertCard per assessment from checkOrder. Each card shows the headline, genotype phenotype vs adjusted phenotype, the confidence flag, the inhibitor note, and the CPIC recommendation.
- Use the UI wording table in docs/PLAN-v3.md. GREEN shows "No supported alert (not the same as safe)".
Demo cases Sarah, Marcus and Priya must work. Commit to dev.
```

### Later tasks (Claude sends each brief when it's time)
Applying the design, the gauge and evidence drawer, `/api/summary` with the validator,
and the CDS Hooks endpoints. Spec sections 5–7.

---

## Ananya → Kiro (spec mode)

### Requirements file (start at 11:30, done by 12:30)

```
Read docs/PLAN-v3.md (the "Kiro spec" and "Clinical rules" sections), .plans/rxgene-build-spec.md sections 1, 2 and 4, and .kiro/steering/clinical-rules.md.

Create a spec named "rxgene-engine". Write ONLY requirements.md for now, in EARS format (WHEN … THE SYSTEM SHALL …). Number every requirement (R1, R2…) so the UI can show which one triggered an alert.

Cover at least:
- activity score sum and phenotype thresholds
- strong (x0), moderate (x0.5) and weak (no change) inhibitors; strongest-only when there are several
- codeine/tramadol computed; atomoxetine + strong uses the PM-equivalent recommendation; atomoxetine + moderate gives "pharmacist review"
- poor metabolizer + inhibitor: the drug alert still fires, plus the "adds no further effect" note
- ultrarapid metabolizer + strong inhibitor: reduced confidence
- adding an inhibitor re-checks drugs already on the list
- an unknown allele gives Not assessed; a missing gene result gives Insufficient data
- the word "Safe" is never shown
- the AI never decides whether an alert appears, and the AI summary is validated or falls back to a template
- clopidogrel is genotype-only (ACS/PCI); omeprazole is a separate label note

Do not write design or code. Stop after requirements.md so I can review it.
```

### Fixture review (by 1:45, no agent needed)
Open `tests/fixtures/expected_outputs.csv` and check every row. Send corrections to
Claude (through Hemnaath). Your answer wins.

---

## Hemnaath → Codex (design only, due 1:30)

```
You are designing (not coding) the UI for RxGene, a pre-prescription pharmacogenomics check for pharmacists. Read README.md, docs/PLAN-v3.md (the "UI language" and "Pitch" sections) and .plans/rxgene-build-spec.md section 7.

Produce a design document in Markdown only. Do not write React or CSS files, because the event requires all code to be written in Kiro. Include:
1. The layout for desktop (judges view it on a laptop) and a usable narrow layout.
2. Design tokens: colors for the RED/YELLOW/GREEN/GREY alert levels (accessible contrast, and never color alone), typography, and spacing.
3. Every component and its states: PatientPicker, MedList, AlertCard, Gauge (one Slow/Reduced/Normal/Fast scale; a hollow marker for "by genes" and a solid one for "right now"; how the animation looks when an inhibitor is added), EvidenceDrawer, ComparisonStrip, PatientSummary (EN/ES toggle and the source tag).
4. Exact UI copy for each state, using the plain-language words in PLAN-v3. Never use the word "safe".
5. What the screen looks like at each beat of the 60–90 second demo script.
Keep it implementable by one developer in about 2 hours.
```

Save Codex's answer as `docs/DESIGN.md` and push it to `dev`. Mithuna's Kiro will apply it.
