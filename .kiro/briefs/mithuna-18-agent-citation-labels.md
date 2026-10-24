Model: claude-sonnet-4.5. Run Kiro with `--agent rxgene`. Run right AFTER brief 17. About 20 min. This is the last blocker for the live agent demo.

Live test on the dev preview after brief 16 (137798e): the agent now completes in ~15–16 s, but R47 still rejects the note, so it ALWAYS falls back to the template:
- Sarah: `validation: R47: invalid citation check_drug(codeine)`. The model cited the tool call by name and arguments.
- Dev: `validation: R47: invalid citation toolu_01Jf7VwgVtFcZfTDZGxVpvKf`. The model cited a provider id that isn't in the trace.
Asking the model to copy opaque tool_call ids back is the brittle part. Stop relying on it.

Fix in web/api/_lib/agent.ts and agentTools.ts (server-path rules apply):
1. **Short labels.** Give each trace entry a stable label in call order: `T1`, `T2`, … Put it at the start of the tool result content you return to the model, e.g. `{"cite_as":"T3", ...result}`. Change the system prompt: "Cite each fact with the cite_as label of the tool result it came from, e.g. [\"T3\"]. Never cite tool_call ids."
2. **Accept these citation forms**, all resolved deterministically against THIS run's trace. Anything that doesn't resolve still fails R47:
   - a label `T<n>` that exists in the trace
   - `tool(arg)`, e.g. `check_drug(codeine)` or `get_evidence(fluoxetine)`, when a call with that tool name and that drug exists in the trace (case-insensitive; `get_patient()` and `list_inhibitors()` take no argument)
   - the tool_call id or providerId (keep the current behavior)
3. Normalize every accepted citation to its `T<n>` label in the returned note, so the ConsultSheet citation chips (R53) link to the right trace step. Show the chips as [T3].
4. Log the raw citation on any R47 failure (keep the existing warn).
5. Tests (consult.test.ts):
   - "T2", "check_drug(codeine)", a tool_call id and a providerId all resolve
   - "check_drug(ibuprofen)" when no such call happened fails
   - "T99" fails
   - the returned note uses T-labels only
   - every existing test still passes

Run `npx tsc -b`, `npx vitest run` and `npm run build`. Don't run git. List the files you changed. The lead re-tests Sarah and Dev on the preview right after your push and expects `source: "ai"`.
