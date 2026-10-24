Wire the new desktop UI (RxGeneUI, merged to dev in PR #6) to the real engine and backend. App.tsx currently mounts RxGeneDemo, which uses synthetic fixtures with no engine and no network. **dev must not reach production in that state.** Keep this bounded and credit-conscious. Desktop only; skip mobile work.

Read first:
- web/src/ui/types.ts (RxGeneUIProps, RxGeneResult)
- web/src/ui/RxGeneUI.tsx (pure presentation; don't change its look)
- web/src/ui/RxGeneDemo.tsx + demoFixtures.ts (the adapter shape to replace)
- web/src/ConnectedApp.tsx (the real logic to reuse)
- web/src/lib/{verdict,cardEntries,requirements,url,cdsClient,moleculeFlow,openfda}.ts
- web/src/components/{EvidenceSheet,PatientExplanationSheet,ConsultSheet}.tsx
- web/api/consult.ts
- .kiro/steering/clinical-rules.md

## Build

1. **`web/src/ui/RxGeneConnected.tsx`:** the real adapter. It renders `<RxGeneUI>` and owns all state. Reuse ConnectedApp's logic; don't rewrite it:
   - patient + medication state seeded from `@/data/patients` (all 8 presets)
   - URL deep links via `lib/url.ts` (`?patient=&meds=&add=&mode=&lang=`); a deep link with `add` runs the check on load
   - the check: EHR mode via `lib/cdsClient.ts` with automatic local fallback (`checkOrder`), exactly as ConnectedApp does today
   - **every** current medication, shown as chips, can be added or removed. Changing meds after a check re-runs it.
   - prescription options = the covered drugs and catalog from `lib/drugCatalog.ts`
2. **`web/src/ui/mapAssessment.ts`:** `toRxGeneResult(assessments, patient, addedDrug)` returns a `RxGeneResult`. It's pure, with no clinical decisions; it maps engine fields only. Extend `types.ts` where needed (add optional fields; don't break RxGeneUI). Rules:
   - **Primary assessment** = highest severity (RED > YELLOW > GREY > GREEN), as `lib/verdict.ts` already orders it. Others stay available to the Evidence sheet. The reverse case (Lena: adding fluoxetine re-alerts codeine) keeps the existing "Adding fluoxetine affects a current medication:" prefix.
   - **Speed map:**
     - Poor → Slow; Intermediate → Reduced; Normal → Normal; Ultrarapid → Fast.
     - The atomoxetine label phenotype ("Poor-metabolizer-equivalent dosing (FDA label)") → Slow, with that label as `scoreNote`.
     - Indeterminate / Insufficient data / "not computed" → `currentSpeed: null`, `currentLabel: "Not assessed"`, no score pair.
   - **flowState:**
     - GREY → `notAssessed` (**neutral: never green throughput**)
     - an inhibitor present AND phenoconverted → `inhibited` for strong, `reduced` for moderate
     - YELLOW without phenoconversion → `guidance`
     - GREEN → `normal`
     - Reuse `lib/moleculeFlow.ts` if it already encodes this; add a unit test that GREY and "not computed" are never `normal`.
   - **Verdict:**
     - `level` = engine alert; headline and rationale from the existing `lib/verdict.ts` / VerdictBar logic, verbatim.
     - GREEN `qualifier` = "(not the same as safe)".
     - The source line from `assessment.source` (guideline · strength).
   - **Keep every qualifier visible:**
     - inhibitorNote (incl. R21 "adds no further effect")
     - reduced confidence (Dev) and both recommendations
     - the clopidogrel label note and ACS/PCI population (Ana)
     - the atomoxetine FDA vs. CPIC "different guidance contexts" text
     - genotype vs. adjusted phenotype
     - the requirement IDs
     
     If RxGeneUI has no slot for one, put it in the verdict `rationale` (short) or rely on the Evidence sheet. Nothing clinical may be dropped.
   - **Never** emit the word "safe" except in "not the same as safe".
3. **Callbacks:**
   - `onEvidence` opens the **existing `EvidenceSheet`** with the real assessments (keep its FAERS section and copy as they are).
   - `onExplanation` opens the **existing `PatientExplanationSheet`** (EN/ES, AI summary + template fallback).
   - `onReviewMedications` POSTs `/api/consult` with `{ patient: { id, name, cyp2d6, cyp2c19, meds }, addedDrug }` and opens the **existing `ConsultSheet`** with note, trace, source, model and reason. Show loading, the template fallback, request errors and **Retry**. **Discard stale responses**: if the patient or meds change while a consult is in flight, ignore its result (use a request id).
   - `onReset` clears the result and the URL `add`.
   - `onTogglePlay` + prefers-reduced-motion, as in RxGeneDemo.
4. **`App.tsx`** mounts `RxGeneConnected`. Keep `RxGeneDemo` and `ConnectedApp` files (unmounted) for reference.

## Tests (Vitest)
- `mapAssessment.test.ts`, for presets:
  - Sarah: RED, Slow, inhibited, score 2.0 → 0
  - Marcus: RED, Slow, note contains "adds no further effect"
  - Priya: GREEN, Normal, qualifier "(not the same as safe)"
  - Tom: GREY, currentSpeed null, flowState notAssessed
  - Dev: rationale or evidence keeps "reduced confidence"
  - Jordan: YELLOW, never "Avoid"
  - Lena: reverse-case prefix
  - Ana: the clopidogrel label note is present
- No output contains "safe" except in "not the same as safe".
- An adapter test with mocked fetch: a stale consult response (patient changed mid-flight) is discarded.

## Done means
`npx tsc -b`, `npx vitest run` (all tests, currently 154+) and `npm run build` are all green. Don't run git. List the files you changed, plus any clinical field you could not place in the UI.
