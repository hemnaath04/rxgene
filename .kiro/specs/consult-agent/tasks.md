# Consult agent tasks

- [x] 1. Deterministic tools (R45, R46, R54) — **done in d558eca**
  - `web/api/_lib/agentTools.ts`: `get_patient`, `check_drug`, `list_inhibitors`, `get_evidence`, OpenAI tool definitions, and `runTool` returning `{ ok, result | error }`.
  - `check_drug` copies engine values verbatim and includes every R56 qualifier field; no tool can create, change or suppress an alert.

- [x] 2. Agent loop and limits (R45, R46, R51) — **done in d558eca (8 rounds, 25 s, 8 s per call; note: the 25 s check runs before each call, so one slow call can overrun it)**
  - `web/api/_lib/agent.ts`: `runConsultAgent(ctx, deps)` with injected `fetch`, `now` and models; parallel tool calls in one round; trace entry per call.
  - Fail to Template on more than 8 rounds, 25 s total, 8 s per call, or model error (try the next model, treat Manifest text as failure).

- [ ] 3. Citation, drug-name, number and wording validators (R33, R47, R49, R50) — **partly done in d558eca. Gaps found in review 2026-10-24: R47 checks only that a cited id exists, not that the cited result contains the fact; R49 recognizes only covered drugs, inhibitors and omeprazole, so a note naming morphine passes; R50 compares against the short trace summaries, so a verbatim CPIC quote ("2 weeks") is rejected; R33 does not catch "unsafe"**
  - Citation check matches structured claims against the cited call's result, not just that the id exists.
  - Drug names via `KNOWN_DRUGS` (alternatives only inside quoted CPIC/FDA text); numbers with the R50 exemptions; full R33 word list with its two exceptions.

- [ ] 4. Coverage validators (R48, R55, R56) — **partly done in d558eca. Gaps: R48 checks "avoid" and dose words anywhere in the note, not per drug, and does not stop a YELLOW drug being called "avoid"; R55 does not check the "genotype result only" label for GREEN**
  - Every RED/YELLOW drug is addressed with its action word; every reviewed drug has a successful `check_drug` call and a mention.
  - GREY keeps the fixed R7/R8/R18 text, GREEN uses the exact wording as a genotype-only result with no "list cleared" claim, and each non-empty qualifier appears in that drug's sentences.

- [ ] 5. Template fallback (R51, R33, R48, R52, R55, R56) — **not complete in d558eca. The Template note drops the R56 qualifiers (omeprazole label note, reduced confidence, inhibitor note, population, both phenotypes) and the GREEN "genotype result only" label, which R51 requires**
  - `templateConsultNote(assessments)`: same headings, one sentence per drug from engine fields, "Draft — pharmacist review required" label, `source: "template"` with a reason.
  - Synthetic trace steps are appended and flagged, so the real trace stays intact (R53); R33, R48, R55 and R56 validators run against Template output in tests.

- [x] 6. `/api/consult` endpoint (R45, R51, R53, R54) — **done in d558eca (not yet on production: /api/consult returns 404 there)**
  - `web/api/consult.ts`: POST request and `{ note, source, reason?, trace, model?, ms }` response; 400 on a bad body; rate limit, OPTIONS and CORS like the other endpoints.
  - Always returns the trace (partial on failure); LLM unavailable returns a Template; confirm the function max duration is above 25 s.

- [x] 7. ConsultSheet UI (R52, R53, R54) — **done in d558eca (draft badge, copy only, trace with citation links; not seen in a browser yet)**
  - "Review full medication list" button beside "Inspect evidence"; right-side Sheet with the draft badge, source tag, running state, trace column (100 ms stagger, reduced-motion safe) and note column with `[n]` citation chips that highlight and scroll to trace steps.
  - "Copy note" only; no send, sign or file action; the main view's alerts and their order stay identical before and after a run.

- [x] 8. Tests and verification (R45–R56) — **done in d558eca (consult.test.ts, including the R54 deep-equal test; all pass)**
  - `web/api/consult.test.ts` (mocked fetch): happy path, uncited sentence, off-list drug, missing RED drug, "safe" wording, 9 rounds ("max rounds"), Manifest fallback to model 2, plus a missing GREY drug (R55) and a dropped reduced-confidence flag (R56), each falling back to Template.
  - R54: `checkOrder` output deep-equal before and after `runConsultAgent`; then `npx tsc -b`, `npm test` and `npm run build` all pass.

Do not run these tasks here. Mithuna is building the agent from brief 12; when her commit lands, tick each task and note the commit hash beside it.
