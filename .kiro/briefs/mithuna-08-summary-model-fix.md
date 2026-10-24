Model: claude-haiku-4.5. web/api/_lib/llm.ts was built from an older version of brief 05. Bring it in line with the current .kiro/briefs/mithuna-05-summary-api.md. As it stands, every Anthropic call fails, so the UI silently shows the template.

1. Remove `temperature` from the request body. Anthropic 5.x models via Manifest returns HTTP 400 "`temperature` is deprecated for this model". Set max_tokens to 600.
2. LLM_MODEL is a comma-separated list (now `anthropic/claude-sonnet-5-subscription,anthropic/claude-sonnet-5-5-subscription`). Split it on commas, trim, and try each model in order, each with its own 6 s timeout. Move to the next model when the call fails OR the text fails validation. After the last model, use the template.
3. Treat the call as failed when: the status isn't 2xx; choices[0].message.content is empty or null; finish_reason is "length"; or the content starts with "[🦚 Manifest" or contains "Manifest M1".
4. Strip Markdown (**, *, #) before validating.
5. Add a validator rule: every number in the CPIC recommendation must appear in the text. Keep the existing "no new numbers" rule. Add "Keep every dose and time from the recommendation exactly." to the system prompt.
6. PatientSummary: show the template immediately with a subtle "Writing a plain-language version…" line, then cross-fade (opacity, 200 ms) to the AI text when it arrives.
7. Update web/api/summary.test.ts with a mocked fetch: temperature is absent from the body; the first model returns a Manifest-error 200, so the second model is used; a text missing "80" fails validation and moves on; both models failing gives the template.

Don't run git. List the files you changed.
