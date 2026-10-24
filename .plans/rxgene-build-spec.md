# RxGene build spec (Hackachusetts, Sat Oct 24 2026)

Source plan: `docs/PLAN-v3.md`. This spec is what the team builds. Where it differs from
v3, the **Deviations** section explains why. Clinical rules live in
`.kiro/steering/clinical-rules.md`. Agent and model roles live in `CLAUDE.md`.

## 1. Decisions (from the interview)

| Topic | Decision |
|---|---|
| Who writes code | **Kiro writes all committed code.** Claude oversees: writes briefs, reviews diffs, gates on tests. Codex only **designs** the frontend (Hemnaath delivers the design). |
| Team | **Mithuna:** engine + API + UI in Kiro. **Ananya:** Kiro requirements file, clinical tables, expected-output review, science pitch. **Hemnaath:** Codex frontend design, demo, submission. **Claude:** lead and reviewer. |
| Phenoconversion scope | Computed for **codeine and tramadol only** (CPIC opioids 2021). Atomoxetine + strong inhibitor uses the PM-equivalent recommendation (FDA label + CPIC atomoxetine 2019 narrative). Atomoxetine + moderate inhibitor shows "pharmacist review" and is not computed. |
| Reverse case | Adding an inhibitor re-checks the **whole medication list** and alerts on CYP2D6 drugs already on it. |
| Washout | Steady-state only. Meds are active or absent; no dates. This is listed under limitations. |
| LLM | An OpenAI-compatible endpoint (base URL and key from Hemnaath). **No AWS, so no Bedrock.** |
| AI guard | The LLM sees only the engine output. Its text is validated (rules in §6); if validation fails, the fixed template is shown. Label: "AI-written from rule output." |
| Spanish | A fixed Spanish template is the fallback. The AI version is labeled "machine-translated, review before giving to patient." |
| Input UX | Preset synthetic patients (genotype locked). Users can freely add and remove meds. |
| Comparison column | "Typical interaction warning (illustrative)": mechanism-level text, no product names, no severity ratings. |
| Gauge | One scale, Slow / Reduced / Normal / Fast, with two markers: hollow = "by genes", solid = "right now". |
| CDS Hooks | **Real endpoints** on Vercel: discovery + order-select service, using the same engine. |
| CYP2C19 | Clopidogrel is genotype-only. Omeprazole appears as a separate label-level note; no computed CYP2C19 phenoconversion. |
| Kiro hooks | Run the fixture tests whenever `web/src/engine/**` is saved. |
| Deploy | Vercel (static Vite build + serverless functions). |
| Repo | **Public now.** A ruleset on `main` requires a PR and blocks force-push and deletion. Push freely to `dev`. |
| Design ETA | Codex design by **1:30 PM**. Otherwise Mithuna ships a plain functional UI for the 2:00 test gate, and the design is applied 2:30–4:30. |

## 2. Deviations from PLAN-v3 (and why)

1. **The CPIC 2023 SSRI guideline does not state the ×0 / ×0.5 convention.** Its main text
   says consensus adjustment approaches "have not been established." Only CPIC opioids
   2021 states the rule, so cite only that. Ananya should verify the "Borges et al."
   citation before it goes on a slide.
2. **Atomoxetine is not computed with the multiplier** (see §1). The v3 statement about
   "dosing pathway, not avoid" still holds: atomoxetine alerts are YELLOW.
3. **No Bedrock or AWS deploy.** Replace the AWS judge angle with "OpenAI-compatible
   model behind a validator; Bedrock is a config swap."
4. **The inhibitor table is the full FDA list** (strong 5, moderate 6, weak 10), verified
   on 2026-10-24. Mirabegron is moderate, as v3 says. Weak inhibitors get no adjustment.
5. **Fixture P12** used to be "fluoxetine stopped 4 weeks ago" and is now the reverse case.
   Added **P22**: a weak inhibitor (sertraline), no adjustment.
6. **The allele table comes from the CPIC API snapshot,** not hand-typed. CYP2D6 \*9,
   \*10 and \*41 are **0.25**.

## 3. Architecture

```
web/ (Vite + React + TS, deployed on Vercel)
  src/engine/        pure TS: no fetch, no React. Reads data/*.json (copied into src/data at build)
  src/components/    OrderScreen, PatientPicker, MedList, AlertCard, Gauge, EvidenceDrawer,
                     ComparisonStrip, PatientSummary, SpecBadge
api/ (Vercel functions, same repo root)
  cds-services.ts                      GET  discovery
  cds-services/rxgene-order-select.ts  POST CDS Hooks service -> engine -> cards
  summary.ts                           POST engine result -> LLM -> validated text (or template)
```

- The engine is imported by both the UI and the API functions, so it's one source of truth.
- Vercel rewrites `/cds-services/*` to `/api/cds-services/*`. CORS is open for GET, POST
  and OPTIONS so the public CDS Hooks sandbox can call it.
- Env vars (Vercel + local `.env`): `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. These must
  never reach the browser bundle (no `VITE_` prefix).

## 4. Engine contract

```ts
type Patient = { id: string; name: string; cyp2d6?: string; cyp2c19?: string; meds: string[] };

type Alert = 'RED' | 'YELLOW' | 'GREEN' | 'GREY';

type DrugAssessment = {
  drug: string;                       // the drug the alert is about
  triggeredBy: string;                // the drug just added (differs in the reverse case)
  gene: 'CYP2D6' | 'CYP2C19';
  genotype: string | null;
  genotypeActivityScore: number | null;     // null for CYP2C19 / missing / indeterminate
  genotypePhenotype: string;                // includes 'Indeterminate' and 'Insufficient data'
  inhibitor: { drug: string; strength: 'strong' | 'moderate' | 'weak' } | null;
  adjustedActivityScore: number | null;
  adjustedPhenotype: string | 'not computed';
  phenoconverted: boolean | null;
  confidence: 'standard' | 'reduced';
  alert: Alert;
  recommendation: string;             // CPIC text verbatim, or the fixed not-assessed text
  strength: string;                   // CPIC classification
  inhibitorNote?: string;             // de-escalation / weak-inhibitor note
  labelNote?: string;                 // e.g. omeprazole + clopidogrel
  source: { guideline: string; url: string; fetched: string };
};

checkOrder(patient: Patient, addedDrug: string): DrugAssessment[]   // re-checks the full list
toCdsCard(a: DrugAssessment): CdsCard
```

**Algorithm.** The rules come from `clinical-rules.md`. Implement them in this order:
1. Sum the allele activity values. A duplication (`*1x2`) counts the allele's value times
   the copy number. An unknown allele gives **Indeterminate**; a missing gene result gives
   **Insufficient data**. Both are GREY.
2. Find the strongest CYP2D6 inhibitor among (meds + addedDrug). Strong → AS × 0;
   moderate → AS × 0.5; weak → no change, plus a note.
3. Map AS to a phenotype: 0 = PM; 0 < AS < 1.25 = IM; 1.25 ≤ AS ≤ 2.25 = NM; > 2.25 = UM.
4. Look up the recommendation. For codeine, tramadol and atomoxetine, look it up by
   **activity score** (quarter-step keys), not by phenotype label. For clopidogrel, look it
   up by CYP2C19 phenotype, using the `CVI ACS PCI` population.
5. Special cases:
   - Genotype UM plus a strong inhibitor: `confidence: 'reduced'`.
   - Genotype AS 0 plus any inhibitor: `inhibitorNote` = "adds no further effect…"
     **and the drug-level alert still fires.**
   - Atomoxetine plus a moderate inhibitor: `not computed`, GREY, "pharmacist review".
6. Alert level:
   - RED: the recommendation starts with "Avoid".
   - YELLOW: a titration or "if no response" pathway.
   - GREEN: standard dosing, shown as "No supported alert (not the same as safe)".
   - GREY: not assessed, insufficient data, no recommendation, or a drug that isn't covered.

**CDS card mapping:**
- Indicator: RED → `critical`, YELLOW → `warning`, GREEN and GREY → `info`.
- `summary`: under 140 characters, plain language.
- `detail`: Markdown with both phenotypes, the recommendation and the strength.
- `source`: `{ label: guideline, url }`.

## 5. API

- `GET /cds-services` → `{ services: [{ id: 'rxgene-order-select', hook: 'order-select',
  title, description, prefetch: {} }] }`.
- `POST /cds-services/rxgene-order-select`
  - Reads `context.patientId`, `context.selections` and `context.draftOrders`
    (a MedicationRequest bundle).
  - For the demo, look up the patient by ID in the synthetic preset table.
  - Map each selected MedicationRequest's display or code text to a drug name.
  - Returns `{ cards: [...] }`. An unknown patient returns `{ cards: [] }`.
- `POST /api/summary` with body `{ assessment, lang: 'en' | 'es' }` returns
  `{ text, source: 'ai' | 'template' }`.

## 6. AI summary

- **Prompt input:** only the `DrugAssessment` fields. The model is told to rewrite the
  content, not change it.
- **Validation.** Any failure means the template is shown:
  - The text contains the `drug` name.
  - The text keeps the alert's action: RED must keep an "avoid / not recommended" meaning
    (keyword list per language); GREEN must not use "safe" or "seguro".
  - The text names no drug that isn't in the input.
  - The text contains no number that isn't in the input.
  - The text is 90 words or fewer.
- Timeout of 6 s, then show the template. Show a small "AI-written from rule output" or
  "Template" tag.
- **Templates:** one per alert type, in EN and ES, in `web/src/engine/templates.ts`.
  Ananya checks the clinical wording in EN.

## 7. UI

**Layout:**
- Top: PatientPicker (presets).
- Left: chart with the gene result in plain words, plus MedList (add/remove; a search box
  over covered drugs, inhibitors and a few uncovered drugs).
- Right: one AlertCard per assessment.

**AlertCard contains:**
- The plain-language headline (see the language table in PLAN-v3).
- The **Gauge** with two markers.
- When `phenoconverted` is true: "Another medicine changed how this patient's genes work."
- The confidence flag, if any.
- The inhibitor note, if any.
- A button that opens the EvidenceDrawer.

**EvidenceDrawer contains:**
- Technical terms: diplotype, AS before and after, phenotypes, inhibitor + FDA class.
- The CPIC recommendation verbatim, its strength, and the guideline link + fetched date.
- The note on the old atomoxetine 2019 thresholds.
- The raw CDS card JSON.
- The matching Kiro requirement (SpecBadge).

**ComparisonStrip** (demo case 1): "Gene report alone" / "Typical interaction warning
(illustrative)" / "RxGene".

**PatientSummary:** EN/ES toggle and the source tag.

**Never** show the word "safe."

**Preset patients** (synthetic; IDs match the fixtures where possible):

| Name | Gene result | Meds | Demo role |
|---|---|---|---|
| Sarah | CYP2D6 \*1/\*1 | fluoxetine | Case 1: add codeine → RED, converted PM |
| Marcus | \*4/\*4 | fluoxetine | De-escalation: codeine still RED, plus the "adds no further effect" note |
| Priya | \*1/\*1 | none | Clean case: GREEN, "No supported alert" |
| Lena | \*1/\*1 | codeine | Reverse case: add fluoxetine → codeine re-alerted |
| Dev | \*1x2/\*2 | paroxetine | UM: reduced confidence |
| Jordan | \*1/\*1 | fluoxetine | Atomoxetine direction: YELLOW (builds up) |
| Tom | \*1/\*999 | none | Not assessed: GREY |
| Ana | CYP2C19 \*2/\*2 | omeprazole | Clopidogrel RED + label note (Layer 2) |

## 8. Tests

- `tests/fixtures/expected_outputs.json` has **22 cases**. Vitest compares the engine on
  `alert`, `genotype_phenotype`, `adjusted_phenotype`, `cpic_recommendation`, `confidence`
  and `inhibitor_note` (substring match).
- A Kiro hook runs `vitest run` when `web/src/engine/**` is saved.
- If a fixture disagrees with Ananya's review, **she wins**. Regenerate with
  `scripts/make_expected.py` after the data changes.
- Add API tests: discovery returns one service; a P01-shaped order-select request returns
  one `critical` card.

## 9. Kiro usage

- `.kiro/specs/rxgene-engine/requirements.md`: Ananya writes the EARS requirements from
  PLAN-v3 "Kiro spec" plus the §1 decisions. Mithuna runs design → tasks in Kiro.
- Kiro models:
  - Engine: `claude-sonnet-4.5`.
  - UI and features: `auto`.
  - Boilerplate and tests: `claude-haiku-4.5`.
  - Check the credit meter at every gate.
- Commit and push to `dev` from Kiro. The submission gets a PR from `dev` to `main`.

## 10. Timeline and gates

| Time | Mithuna (Kiro) | Ananya | Hemnaath | Claude |
|---|---|---|---|---|
| 11:30–12:30 | Vite scaffold, engine steps 1–3, fixtures wired | Requirements file; review allele/inhibitor tables | Codex design starts; LLM URL/key to `.env` | Briefs, reviews, Vercel project |
| 12:30–2:00 | Engine steps 4–6, CDS card, plain UI, cases 1–3 | Review fixtures (sign off by 1:45) | Design by **1:30** | Review diffs vs. fixtures |
| **2:00–2:30** | **Test gate:** all 22 pass. Record a rough backup video | Clinical spot-check | Backup video | Gate decision |
| 2:30–4:30 | Apply design, gauge, drawer, reverse case, summary API + validator, ES | Templates (EN) wording, pitch science | Demo script, slides | CDS endpoints check, deploy preview |
| 4:30–5:30 | CDS endpoints, clopidogrel path, Layer 3 only if ahead | Verification checklist (PLAN-v3) | Slides | README limitations |
| **5:30** | **Freeze**: re-run fixtures | Final sign-off | | |
| 5:30–7:15 | Prod deploy | | Final video | PR `dev` → `main`, merge |
| **by 7:30** | | | **Submit SundAI card** (public repo URL + demo URL + video) | Verify submission |

## 11. Limitations (for the README)

- Synthetic data only.
- Steady-state model: no inhibitor onset or washout.
- Phenoconversion is computed only where CPIC states the rule (opioids).
- If several inhibitors are listed, the strongest is applied (a design choice).
- CYP2C19 phenoconversion isn't modeled.
- Not a medical device. "No supported alert" does not mean safe.

## 12. Still needed from the user

- LLM base URL, API key and model name. Put them in `.env` and in the Vercel env; never
  paste them into the repo.
- The Codex frontend design, by 1:30 PM.
- Who records the demo video (assumed: Hemnaath).
