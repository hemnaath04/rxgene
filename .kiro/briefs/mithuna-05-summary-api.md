Model: claude-sonnet-4.5. Read .plans/rxgene-build-spec.md section 6, .plans/rxgene-architecture-spec.md section 5, and requirements R33-R37 in .kiro/specs/rxgene-engine/requirements.md.

Task: the plain-language patient summary. The AI rewrites the engine's output and never decides anything.

1. web/src/engine/templates.ts: renderTemplate(assessment, lang: 'en'|'es'). One template per alert level (RED, YELLOW, GREEN, GREY), plus optional sentences for the phenoconversion, inhibitorNote and confidence fields. Use the plain-language words from docs/PLAN-v3.md ("cleanup crew", "clears this drug: Slow"). Never describe anything as safe or seguro; the only allowed phrase is "not the same as safe" / "no es lo mismo que seguro".
2. web/api/_lib/llm.ts:
   - callLlm(messages): plain fetch POST to `${process.env.LLM_BASE_URL}/chat/completions` with Authorization Bearer LLM_API_KEY, model LLM_MODEL, temperature 0, max_tokens 220, and a 6 s AbortController timeout.
   - validate(text, assessment, lang): the text must include the drug name and the action (RED must keep an avoid/not-recommended meaning: en "avoid|not recommended|won't work|may not work", es "evitar|no se recomienda|puede no funcionar"); GREEN must not contain safe/seguro except in "not the same as safe"; it may name no drug outside the assessment; it may contain no number that isn't in the input; it must be 90 words or fewer.
   - A cache Map keyed by sha256(JSON.stringify(assessment)+lang), max 500 entries.
   - A rate limit of 20 per minute per x-forwarded-for IP (in-memory sliding window).
3. web/api/summary.ts: POST { assessment, lang } returns { text, source: 'ai'|'template', rateLimited?: boolean }. If the env vars are missing, the LLM fails, or validation fails, return the template. Never log the key or the full prompt.
4. PatientSummary component: EN/ES tabs and a source tag ("AI-written from rule output" or "Template"). The Spanish AI text also shows "Machine-translated: review before giving to patient."
5. Tests (web/api/summary.test.ts) with a mocked fetch: a valid AI text passes; a text that drops "avoid" falls back to the template; a text that adds a new drug name falls back; a text containing "safe" falls back; a 7 s delay falls back; the 21st call in a minute is rate-limited.

Don't run git. List the files you changed.
