Model: claude-sonnet-4.5. Run AFTER brief 11. Target: working on the dev preview by 5:00 PM (freeze is 5:30).

Read first: .kiro/briefs/ananya-02-agent-requirements.md (requirements R45-R54) and .kiro/specs/rxgene-engine/requirements.md, which now holds R45-R56, web/api/_lib/llm.ts, web/api/summary.ts, and web/src/engine/index.ts.

Goal: a **pharmacist consult agent**. The pharmacist clicks "Review full medication list". An LLM agent calls deterministic tools for every drug on the list and drafts a consult note with citations. The rule engine still decides everything; the agent only gathers tool results and writes them up. Tool calling through our gateway is verified: `anthropic/claude-sonnet-5-subscription` with OpenAI-style `tools` returned a correct `tool_calls` response in 1.8 s.

Server-path rules from brief 09 still apply: every relative import gets a `.js` extension, JSON imports use `with { type: 'json' }`, no '@/' alias, and no `temperature` field.

## 1. Tools: web/api/_lib/agentTools.ts (pure, no network)
The patient (genotypes + meds) and the optional addedDrug come in the request body. Tools read from that context and never from the model's arguments, except for the drug name.
- `get_patient()` returns `{ name, cyp2d6, cyp2c19, meds, addedDrug }`.
- `check_drug({ drug })` returns the engine's DrugAssessment for that drug, run against the full list (checkOrder), in a compact form: drug, gene, genotypePhenotype, adjustedPhenotype, genotypeActivityScore, adjustedActivityScore, inhibitor, confidence, alert, recommendation, strength, inhibitorNote, labelNote, requirement IDs. If the drug isn't on the list and isn't the added drug, return an error.
- `list_inhibitors()` returns the CYP2D6 inhibitors on the list with their FDA class (from data/inhibitors.json).
- `get_evidence({ drug })` returns the guideline name, url, fetched date and strength from the assessment's source.
Export OpenAI-format tool definitions (JSON Schema params) and an executor `runTool(name, args, ctx)` that returns `{ ok, result | error }`.

## 2. Agent loop: web/api/_lib/agent.ts
`runConsultAgent(ctx, deps)`:
- `deps` are injected so tests can mock them: `fetch`, `now`, and the model list from llmConfig().
- Messages: a system prompt (below) and a user message with the patient name and the list size.
- POST `${LLM_BASE_URL}/chat/completions` with `{ model, messages, tools, tool_choice: "auto", max_tokens: 1200 }`. No temperature.
- On `finish_reason: "tool_calls"`: run every call with runTool, append the assistant message (including tool_calls), then one `{ role: "tool", tool_call_id, content: JSON.stringify(result) }` per call, and loop.
- Record a trace entry for every tool call: `{ id: tool_call_id, tool, args, summary, ms }`. The summary is short and human-readable, e.g. `check_drug(codeine) → RED · Avoid codeine`.
- Stop with a failure when there are more than 8 rounds, the whole run exceeds 25 s, or an 8 s per-call timeout passes. On a model error, try the next model in LLM_MODEL. Treat Manifest error text (`[🦚 Manifest`) as a failure, as in llm.ts.
- The final assistant message must be ONLY JSON:
  `{ "sections": [ { "heading": string, "sentences": [ { "text": string, "cites": [tool_call_id, ...] } ] } ] }`.
  Suggested headings: "Pharmacogenomic summary", "Medication-specific findings", "Drug–drug–gene interactions", "Recommendations for prescriber".
- System prompt essentials:
  - You are drafting a pharmacogenomics consult note for a pharmacist to review.
  - Call check_drug for every medication and for the added drug.
  - Every factual sentence must cite the tool_call ids it came from.
  - State only what the tools returned, and keep each drug's action.
  - Never call anything safe.
  - Don't add drugs, doses or numbers that are not in tool results.
  - Output only the JSON.

## 3. Validation (R47-R50, R33) and the template fallback (R51)
`validateNote(note, trace, assessments)` fails when:
- a sentence cites an id that isn't in the trace;
- a sentence mentions RED/YELLOW/avoid/adjust/phenotype/activity score/inhibitor/a recommendation without any cite;
- a RED or YELLOW drug isn't mentioned, or its action word is missing (RED: avoid; YELLOW: adjust/titrat/dose);
- the note names a drug outside the list + addedDrug + the drugs named in the recommendation texts (use KNOWN_DRUGS from fhir.ts to detect drug names);
- the note contains a number not found in JSON.stringify(trace results);
- the note contains "safe"/"seguro", except in "not the same as safe".
Also enforce Ananya's added rules (see the spec):
- **R55:** every medication on the list must have a check_drug call in the trace AND a mention in the note. A GREY drug's sentence must contain the engine's fixed GREY text verbatim (from messages.ts). A GREEN drug must use exactly "No supported PGx alert (not the same as safe)", be labeled a genotype result only, and never imply the whole list is cleared.
- **R56:** when the engine returns a qualifier, the note must keep it: both phenotypes side by side, the reduced-confidence flag, the poor-metabolizer inhibitor note, the atomoxetine FDA/CPIC "Different guidance contexts" text, the omeprazole–clopidogrel label note, and the population for atomoxetine/clopidogrel. Simplest enforcement: put these qualifier strings in the check_drug result and require each non-empty one to appear (case-insensitive substring) in the note's sentences for that drug.
Add tests for both R55 and R56: a missing GREY drug falls back to the template, and a dropped reduced-confidence flag falls back to the template.

On any failure, or when the LLM is unavailable, build `templateConsultNote(assessments)` deterministically: the same section headings, one sentence per assessment built from the engine fields, and cites pointing at synthetic trace ids. Return `source: "template"` and a reason.

## 4. Endpoint: web/api/consult.ts
`POST { patient: { id, name, cyp2d6?, cyp2c19?, meds: string[] }, addedDrug?: string }` returns `{ note, source: "ai" | "template", reason?, trace, model?, ms }`. Reuse clientIp/isRateLimited from llm.ts. An invalid body returns 400. Add OPTIONS and CORS like the other endpoints.

## 5. UI
- A "Review full medication list" button in the verdict-bar actions, next to "Inspect evidence".
- A `ConsultSheet` (shadcn Sheet, right side, ~720px wide, `overscroll-behavior: contain`):
  - Header: "Pharmacist consult draft". Badge: "Draft — pharmacist review required" (R52). Plus a source tag, "AI agent · {model}" or "Template".
  - While running: a skeleton and "Agent reviewing {n} medications…".
  - Left column: the trace (R53), a numbered list of steps showing tool, args and summary, revealed with a 100 ms stagger (display only; respects reduced motion).
  - Right column: the note sections. Each citation is a small chip `[1]`; hovering or focusing it highlights the matching trace step, and clicking scrolls to it.
  - A "Copy note" button (plain text with citations). There is NO send/sign/file action (R52).
- The main view's alerts must not change after the agent runs (R54).

## 6. Tests: web/api/consult.test.ts (mocked fetch)
1. Happy path: the model calls check_drug twice, then returns valid JSON → `source: "ai"`, the trace has 2 entries, and every cite resolves.
2. An uncited factual sentence → template.
3. A note naming a drug not on the list → template.
4. A RED drug missing from the note → template.
5. A note containing "safe" → template.
6. 9 rounds of tool calls → template, reason "max rounds".
7. A Manifest error-text reply on model 1 → model 2 is used.
8. R54: checkOrder output for the patient is deep-equal before and after runConsultAgent.

Run `npx tsc -b`, `npm test` and `npm run build`. All must pass. Don't run git. List the files you changed. Claude verifies the live agent on the dev preview after your push.
