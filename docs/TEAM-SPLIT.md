# Team split: who does what today

**Read this first.** It's the short version of the build spec. **What to paste into your agent:** [AGENT-PROMPTS.md](AGENT-PROMPTS.md). Details:
- Build spec (source of truth): [`.plans/rxgene-build-spec.md`](../.plans/rxgene-build-spec.md)
- Strategy and pitch: [`docs/PLAN-v3.md`](PLAN-v3.md)
- Clinical rules Kiro must follow: [`.kiro/steering/clinical-rules.md`](../.kiro/steering/clinical-rules.md)

**Rules for everyone**
- Everyone runs **Claude Code as the lead** and **Kiro CLI as the coder** (setup: [AGENT-PROMPTS.md](AGENT-PROMPTS.md)). Kiro writes all code, which is an event requirement. Claude follows [`CLAUDE.md`](../CLAUDE.md).
- Work on the `dev` branch, and push to it often.
- `main` changes only through a PR from `dev`.
- Never put API keys in the repo. They go in `.env` only.
- **Submit by 7:30 PM.** Submissions lock at 8:00.

**Vercel:** project `rxgene` (Hemnaath's projects). Root `web`, production branch `main` (public URL for judges), pushes to `dev` give login-protected previews. LLM env vars are set for Production and Preview.

**Gates**

| Time | Gate |
|---|---|
| 1:30 PM | Frontend design handed over (otherwise Mithuna ships the plain UI) |
| **2:00 PM** | **Test gate.** All 22 fixtures pass, and a rough backup video is recorded. |
| **2:30 PM** | LLM base URL, key and model are in `.env` and the Vercel env |
| **6:30 PM** | **Code freeze.** Re-run all tests and check_live.py. (Moved from 5:30: the event only closes submissions at 8:00.) |
| 6:45 PM | Last PR from `dev` to `main` merged; production checked with check_live.py |
| **7:30 PM** | SundAI card submitted (the event's 30-minute reminder). **Hard deadline: 8:00 PM sharp.** |

---

## Mithuna: engine, API and UI (in Kiro)

Kiro models:
- `claude-sonnet-4.5` for the engine.
- `auto` for the UI.
- `claude-haiku-4.5` for boilerplate.

### By 2:00: Layer 1
- [ ] Scaffold Vite + React + TS in `web/`. Add Vitest.
- [ ] Engine in `web/src/engine/`, implementing spec §4 steps 1–6. Pure TS; no fetch, no
      React.
- [ ] A Vitest suite that runs every case in `tests/fixtures/expected_outputs.json`.
- [ ] A Kiro hook that runs the tests when `web/src/engine/**` is saved.
- [ ] Plain UI: patient picker (spec §7 presets), med list with add/remove, one alert card
      per assessment.
- [ ] Demo cases 1–3 work: Sarah, Marcus and Priya.
- [ ] **All 22 fixtures pass.** Push to `dev`.

### 2:30–4:30: Layer 2
- [ ] Order of briefs: 06 (design) → 04 (EHR mode + URL) → 05 (summary, once the LLM details arrive).
- [ ] Apply the frontend design. Gauge with two markers, evidence drawer, comparison strip.
- [ ] Reverse case (Lena), UM reduced confidence (Dev), atomoxetine (Jordan).
- [ ] `POST /api/summary`: OpenAI-compatible call, the validator (spec §6), and the EN/ES
      template fallback.

### 4:30–6:30: Layer 2b/3
- [ ] CDS Hooks: `GET /cds-services` and `POST /cds-services/rxgene-order-select` (spec §5).
- [ ] The clopidogrel path (Ana), with omeprazole as a label note.
- [ ] Layer 3 only if everything above is done.

**Done means:** fixtures pass, demo cases work on the Vercel preview, and no "safe"
wording appears anywhere.

---

## Ananya: Kiro spec, science and clinical review

### By 12:30
- [x] Write `.kiro/specs/rxgene-engine/requirements.md`. Use EARS "WHEN … THE SYSTEM
      SHALL …" requirements, starting from the PLAN-v3 "Kiro spec" section and spec §1.
      Mithuna runs design → tasks from it.
- [x] Check `data/inhibitors.json` against the FDA table, and check the allele values for
      every demo patient in `data/cpic/cyp2d6_alleles.json`.

### By 1:45
- [x] Review all 22 rows in `tests/fixtures/expected_outputs.csv` *(now 25 rows, all approved at the expected-output level)*. **If you disagree with
      a row, you win.** Tell Claude, who regenerates the fixtures.

### 2:30–6:30
- [ ] Check the clinical wording of the EN templates (`web/src/engine/templates.ts`) *(review done; fixes pending from Mithuna)*.
- [x] Work through the PLAN-v3 pre-pitch verification checklist (open the real CPIC PDFs).
- [x] Verify the Borges et al. citation, or drop it from the slides *(verified; claim narrowed)*.
- [ ] Write the science part of the pitch, for tonight and for Sunday *(approved; not yet sent to Hemnaath)*.

**Done means:** a signed-off fixtures file, a requirements file in Kiro, and the
checklist ticked.

---

## Hemnaath: design, demo and submission

- [ ] **By 1:30:** the Codex frontend design (design only; Mithuna implements it in Kiro).
- [ ] **By 2:30:** the LLM base URL, key and model, in local `.env` and the Vercel env.
- [ ] **2:00:** record the rough backup video once Layer 1 passes.
- [ ] 2:30–6:30: demo script (PLAN-v3, 60–90 s) and slides (30 s and 3 min versions).
- [ ] 6:45–7:30: record the final demo video on the production URL.
- [ ] **By 7:30:** the SundAI card, with the public repo URL, the demo URL, the video and
      the Biotech & Healthcare track.

---

## Claude: lead and reviewer

- [ ] Write a Kiro brief for each task, and review every diff against the fixtures and
      `clinical-rules.md`.
- [ ] Regenerate the fixtures when Ananya changes a row.
- [ ] Set up the Vercel project and check the CDS Hooks endpoints.
- [ ] README limitations section.
- [ ] Open and merge the last PR from `dev` to `main` by 6:45. Verify the SundAI submission.

## Added at 2:45 PM: pharmacist consult agent

- **Ananya:** `.kiro/briefs/ananya-02-agent-requirements.md` adds R45–R54 to the spec by 3:15.
- **Mithuna:** brief 11 (verdict layout), then `.kiro/briefs/mithuna-12-consult-agent.md`, working on the dev preview by 6:00.
- **Claude:** verifies the live agent on the preview, then merges to main by 6:45 (code freeze 6:30).
- **Pitch line:** "An AI agent drafts the pharmacist's consult note, but every sentence cites a rule-engine result, and if it can't, you get the deterministic template."

## Added at 3:00 PM: more Kiro features

- **Mithuna:** brief 14 (`.kiroignore`, a PreToolUse guard on clinical data, a Stop hook that runs the tests). Order: 13 → 14 → 12.
- **Ananya:** `ananya-03-analyze-and-agent-spec.md` (Analyze Requirements on R1–R56, plus the consult-agent design.md and tasks.md), by 3:45.

## Added at 3:10 PM: openFDA (organizers' data portal)

- Claude saved openFDA FAERS counts for 10 demo drug pairs to `data/openfda/pair_reports.json`.
- **Mithuna:** brief 15 (Evidence-sheet panel) runs only if brief 12 is done before 6:00. Order: 13 → 14 → 12 → (15).
- **Pitch / SundAI card:** challenge **H4** ("hard to translate"). We use the portal's FHIR guidance (standard shapes, not private JSON) and its openFDA API.

