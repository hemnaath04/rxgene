# RxGene architecture and tech stack spec

Builds on `.plans/rxgene-build-spec.md` (what we build). This file covers **how** we build
it. Where the two disagree on structure, this file wins: `api/` is now `web/api/`.
Package versions were checked on npm on 2026-10-24.

## 1. Decisions

| Area | Decision |
|---|---|
| Repo layout | **One package in `web/`.** The Vercel project's Root Directory is `web/`. Serverless functions live in `web/api/` and import the engine from `../src/engine`. |
| Data | Repo-root `data/` stays the source of truth. The `predev`, `prebuild` and `pretest` scripts copy `../data` to `web/src/data/` (gitignored). The engine imports the JSON statically. Vercel includes files outside the root directory by default for new projects ([Vercel KB](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions)). |
| UI stack | Vite + React + TypeScript, **Tailwind v4** (`@tailwindcss/vite`), **shadcn/ui**, **Motion** for the gauge and card transitions, and `lucide-react` icons (shadcn's default). |
| Versions | Use whatever create-vite's `react-ts` template pins (TypeScript included; **don't force TS 7**). Install everything else at latest, commit `package-lock.json`, and upgrade nothing today. Today's latest: Vite 8.3.5, React 19.3.1, Tailwind 4.3.3, Vitest 5.0.5, shadcn 4.22.1, Motion 14.6.0. |
| Package manager | npm. |
| Engine location | `web/src/engine/`: pure TS. The browser (Local mode) and the functions (EHR mode) run **the same module**. |
| App mode | **Default EHR mode.** The UI sends a real CDS Hooks request to our own endpoint and renders the cards it returns. If the call fails or takes more than 3 s, it **falls back to Local mode** automatically, with a visible badge on each card ("via CDS Hooks" or "local fallback"). A toggle switches modes. |
| Function style | Web-standard handlers (`export async function GET/POST(request: Request): Promise<Response>`) on the default Node runtime. No Edge runtime. |
| Local API | A small Vite dev plugin mounts the `web/api/*` handlers on the dev server, so `npm run dev` serves the UI and API on one port. No Vercel CLI is needed. |
| LLM | Always live through the OpenAI-compatible `POST {LLM_BASE_URL}/chat/completions`, called with plain `fetch` (no SDK). Protections: an **in-memory cache** keyed on assessment + language, a **per-IP rate limit** (20/min), a 6 s timeout, then the validator, falling back to the template. |
| Genotype source (CDS) | First the **prefetch** FHIR genomics Observation, then a `fhirServer` fetch (3 s timeout), then "Insufficient data". |
| CDS proof | Register the production discovery URL in the public **CDS Hooks sandbox** and record a clip. |
| Deep links | All state lives in the URL: `?patient=sarah&meds=fluoxetine&add=codeine&mode=ehr&lang=en`. |
| Deploy | Hemnaath's Vercel account with Git integration. A push to `dev` creates a **protected preview** (a Vercel login is required). Merging the `dev` → `main` PR deploys the **public production URL** that judges get. |
| Tests | Vitest: the 22 engine fixtures, plus handler tests (discovery, order-select, summary validator with a fake LLM). **No Playwright** (disk is about 96% full). |

## 2. Layout

```
web/
  package.json            scripts: predev/prebuild/pretest = copy ../data -> src/data
  vite.config.ts          react, tailwindcss, @ alias, devApi() plugin
  components.json         shadcn config
  api/
    cds-services.ts                         GET  discovery
    cds-services/rxgene-order-select.ts     POST service
    summary.ts                              POST summary
    _lib/fhir.ts       FHIR <-> engine mapping (genotype Observation, MedicationRequest -> drug)
    _lib/llm.ts        OpenAI-compatible call, cache, rate limit, validator
  src/
    engine/            index.ts, activityScore.ts, phenotype.ts, phenoconversion.ts,
                       recommend.ts, cdsCard.ts, templates.ts, *.test.ts
    data/              (generated copy of ../data; gitignored)
    components/ui/     shadcn generated
    components/        PatientPicker, MedList, AlertCard, Gauge, EvidenceDrawer,
                       ComparisonStrip, PatientSummary, ModeToggle
    lib/               cdsClient.ts (builds the CDS request from app state), url.ts
    data/patients.ts   the 8 preset patients (hand-written, tracked; the copy step must not overwrite it)
```

The data copy goes to `src/data/cpic/` and `src/data/inhibitors.json`. `src/data/patients.ts`
is tracked, so gitignore only the copied paths. Files under `api/_lib/` aren't deployed
as routes; Vercel ignores paths that start with `_`.

`vercel.json` (or `vercel.ts`) in `web/` rewrites `/cds-services/:path*` to
`/api/cds-services/:path*`. It also sets CORS headers on `/api/cds-services/*` and
`/cds-services/*`: `Access-Control-Allow-Origin: *`, the methods GET, POST and OPTIONS,
and the headers `Content-Type` and `Authorization`.

## 3. Data flow

**EHR mode (default):**
1. UI state (patient, meds, added drug) goes to `cdsClient.buildRequest()`, which returns
   an `order-select` request:
   - `context: { userId, patientId, selections: [addedRequestId], draftOrders: Bundle(MedicationRequest[]) }`
   - `prefetch.patient`
   - `prefetch.pgx`: a Bundle with a genotype Observation for CYP2D6 (and CYP2C19 when
     the patient has one).
2. `POST /cds-services/rxgene-order-select`.
3. `fhir.ts` maps the request to `(Patient, addedDrug)`. `checkOrder()` returns a
   `DrugAssessment[]`, and `toCdsCard()` turns each one into a card.
4. The response is `{ cards }`. The UI renders the cards, and the badge reads "via CDS
   Hooks".
5. On an error or timeout, the UI calls `checkOrder()` locally, and the badge reads
   "local fallback".

**Local mode:** UI state → `checkOrder()` → cards. No network.

**Summary:** after cards render, each card calls `POST /api/summary { assessment, lang }`
lazily. The response is `{ text, source: 'ai' | 'template' }`.

## 4. FHIR mapping (`api/_lib/fhir.ts`)

**Genotype Observation.** This follows the HL7 Genomics Reporting IG; examples:
[STU2 PGx genotype](https://hl7.org/fhir/uv/genomics-reporting/STU2/Observation-Pgx-geno-1001.html)
and [CYP2D6 PharmVar example](https://hl7.org/implement/standards/fhir/uv/genomics-reporting/Observation-GenotypeExamplePharmVar.html).
- `code`: LOINC `84413-4` (match on the code, not the display text, which differs between
  versions).
- `component[]`: one with code LOINC `48018-6` (gene studied) and
  `valueCodeableConcept.coding[].code` = `HGNC:2625` (CYP2D6) or `HGNC:2621` (CYP2C19). Both IDs verified against the HGNC REST API on 2026-10-24.
- The diplotype is read from `valueCodeableConcept.text`, `valueString`, or the first
  `coding.display`. Strip any `CYP2D6` prefix and PharmVar suballele suffixes
  (`*1.001` → `*1`).
- No Observation, or one that can't be parsed, gives `genotype: null`, which the engine
  reports as Insufficient data.

**Medications.** Every entry in `draftOrders` plus, when present, active MedicationRequests
in `prefetch.medications`.
- The drug name comes from `medicationCodeableConcept.text` or `coding[].display`, matched
  case-insensitively against a known-ingredient list (every drug in `data/cpic/recommendations`
  plus `data/inhibitors.json`).
- An RxNorm ingredient-code map is optional. If it's added, take each RxCUI from RxNav,
  not from memory.
- The added drug is the order whose `id` is in `context.selections`.

**Discovery** returns one service with `hook: 'order-select'` and prefetch templates:
- `patient: 'Patient/{{context.patientId}}'`
- `pgx: 'Observation?patient={{context.patientId}}&code=http://loinc.org|84413-4'`
- `medications: 'MedicationRequest?patient={{context.patientId}}&status=active'`

**Hedge:** if the sandbox's Rx View fires a different hook, add a second service
`rxgene-order-sign` that uses the same handler. Claude checks this at the 4:30 gate.

## 5. LLM layer (`api/_lib/llm.ts`)

- Env vars: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. These are server-only; never add
  a `VITE_` prefix.
- The request is `chat/completions` with **no `temperature`** (Claude 5.x via Manifest returns 400 if it is sent) and `max_tokens: 600` (tested 2026-10-24: Haiku 5.5 needs the room for reasoning). `LLM_MODEL` is a comma-separated fallback list. The Manifest gateway returns HTTP 200 with an error message as the content, so check the content, not just the status (see brief 05). The system
  prompt says: rewrite this structured result for a patient in `<lang>`, change no facts,
  and add nothing.
- **Cache:** a `Map` keyed by `sha256(JSON(assessment)+lang)`, capped at 500 entries. It
  lives per function instance (Fluid Compute reuses instances).
- **Rate limit:** 20 requests per minute per `x-forwarded-for` IP, using an in-memory
  sliding window. Over the limit, return the template with `source: 'template'` and
  `rateLimited: true`.
- **Validator:** as in build spec §6. On failure, use the template.
- Never log the API key or full prompts.

## 6. UI components (shadcn)

Generate these with `npx shadcn@latest add …`:
- `card`, `badge`, `button`, `sheet` (evidence drawer), `tabs` (EN/ES), `switch` (mode
  toggle), `command` and `popover` (med search combobox), `select` (patient picker),
  `tooltip`, `separator`, `skeleton`.

Use Motion (`motion/react`) only for:
- the gauge markers sliding apart (spring, about 600 ms)
- cards entering and leaving (`AnimatePresence`)

Respect `prefers-reduced-motion`.

Visual design comes from `docs/DESIGN.md` (Codex, due 1:30). Until then, use the shadcn
defaults.

## 7. Scaffold, run by Claude, not Kiro (these are generators, not AI code)

```bash
cd ~/projects/rxgene && git switch dev && git pull --rebase origin dev
rm web/.gitkeep
npm create vite@latest web -- --template react-ts    # answer "no" to install/start prompts
cd web && npm install
npm install tailwindcss @tailwindcss/vite motion lucide-react
npm install -D vitest @types/node
```

Next, Kiro runs `.kiro/briefs/mithuna-00-config.md` (model `claude-haiku-4.5`), which
covers vite.config, tsconfig paths, index.css, the data-copy scripts and .gitignore.
After that, Claude runs:

```bash
npx shadcn@latest init        # accept the defaults; it detects Vite + Tailwind v4
npx shadcn@latest add card badge button sheet tabs switch command popover select tooltip separator skeleton
npx vitest run                # 0 tests is fine at this point
```

Commit `web/` (including `package-lock.json`) to `dev`.

## 8. Vercel setup (Hemnaath + Claude, at the 2:00 gate)

1. Import `hemnaath04/rxgene` into Hemnaath's Vercel account. Set the Root Directory to
   `web` and the framework preset to Vite.
2. Add the env vars `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` for Production and
   Preview.
3. The production branch is `main`, so `dev` pushes become protected previews. Teammates
   use `npm run dev` locally. Hemnaath can share a preview with the Vercel share link
   when needed.
4. Check that `GET https://<prod>/cds-services` returns the discovery JSON, that CORS
   headers are present, and that the order-select test passes.

## 9. Risks and fallbacks

| Risk | Fallback |
|---|---|
| A function cold start or error during judging | EHR mode falls back to local automatically; cards still render |
| The LLM key is rate-limited or down | The template text, labeled "Template" |
| shadcn init clashes with the template's TS config | Do the manual alias steps (shadcn Vite docs), then run init again |
| The sandbox's Rx View uses another hook | The second service `rxgene-order-sign` |
| The data copy is missing on Vercel | `prebuild` fails loudly; check it on the first preview |
