Model: claude-haiku-4.5. **Run FIRST**, before 13/14/15. About 10 min. It's the critical path for the agent demo.

Bug, found by testing the live agent on the dev preview (d558eca): `/api/consult` ALWAYS returns `source: "template"`, reason "model call failed", after ~12 s. Vercel log: `[agent] model 1: LLM timeout`.

Claude measured each real model call locally (Sarah: fluoxetine + codeine, LLM_MODEL from .env):
- call 1 (Sonnet 5): 1.5 s, asks for get_patient
- call 2: 2.6 s, 5 parallel tool calls
- call 3, writing the final JSON note: **times out at the 8 s per-call limit**. Replayed without a timeout, it took **9.8 s**, used **1,238 output tokens** (just over the current `max_tokens: 1200`, so the JSON is truncated with finish_reason "length") and gave valid JSON once max_tokens was 4000.

Fix in web/api/_lib/agent.ts (server-path rules: .js extensions, no '@/', no temperature):
1. `max_tokens`: 1200 → **2500**.
2. Per-call timeout: 8 s → **15 s**. Keep `MAX_TOTAL_MS = 25_000` (R51). Before each call, pass `min(15 s, remaining budget)` as that call's timeout. The measured total is ~14 s, so it fits.
3. Add to the system prompt: "Be concise: one sentence per medication finding (plus required qualifiers), at most 2 sentences in other sections." This cut the note to ~1,600 tokens / 6.7 s on Haiku in testing.
4. If finish_reason is "length", treat it as a model failure and move to the next model (don't send truncated JSON to the validator), and log `[agent] model N: truncated`.
5. The template fallback currently returns sentences with `cites: []`, so the citation chips (R53) have nothing to link. Give each template sentence the synthetic trace id of the check_drug / get_evidence step it came from.
6. Tests (consult.test.ts): a final call that takes 10 s (mocked clock) still succeeds; a finish_reason "length" reply goes to the next model; template sentences have non-empty cites that resolve in the trace.

Run `npx tsc -b`, `npm test` and `npm run build`. Don't run git. List the files you changed. Claude re-tests the live agent on the preview right after your push and expects `source: "ai"` for Sarah.
