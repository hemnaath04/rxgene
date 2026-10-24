Model: claude-sonnet-4.5. Run Kiro with `--agent rxgene`. About 30 min; finish by 5:45 PM, before the UI work. If the new UI arrives first, pause this and do the UI brief.

Source: Ananya's review of the consult agent in `.kiro/specs/consult-agent/tasks.md`, tasks 3, 4 and 5. Fix the gaps in this order. Item 1 matters most: the template is the safety net.

1. **Template fallback keeps every qualifier (task 5, R51/R55/R56).** `templateConsultNote` currently drops the omeprazole–clopidogrel label note, the reduced-confidence flag, the R21 inhibitor note, the population used (atomoxetine adults, clopidogrel ACS/PCI) and the side-by-side genotype vs. adjusted phenotype, plus the GREEN "genotype result only" label. Build each drug's sentence(s) from ALL non-empty engine fields. Synthetic trace steps are appended and flagged, so the real trace stays intact (R53).
2. **R33:** also reject "unsafe", "safety" and "seguro"/"segura". The only allowed phrase is the fixed "not the same as safe" / "no es lo mismo que seguro".
3. **R48 per drug:** each RED drug's own sentences must carry an avoid/not-recommended meaning, and each YELLOW drug's a dose/titration/adjust meaning. A YELLOW drug must NOT be described with "avoid".
4. **R49:** detect drug names with `KNOWN_DRUGS` plus a small list of common opioids and metabolites (morphine, hydrocodone, oxycodone, hydromorphone, prasugrel, ticagrelor). Allow a name only if it's on the list, is the added drug, or appears in a returned CPIC/FDA recommendation text in this run's trace. Add "Do not name metabolites or alternative drugs unless they appear in a tool result" to the system prompt.
5. **R50:** compare numbers against the full tool results (JSON.stringify of every result in the trace), not the short trace summaries, so a verbatim CPIC quote like "2 weeks" or "40 mg/day" passes.
6. **R55 GREEN:** a GREEN drug's sentence must contain "No supported PGx alert (not the same as safe)" and "genotype result only".

Tests (consult.test.ts): one per item, plus "the template note for Dev keeps 'reduced confidence'", "the template for Ana keeps the clopidogrel label note and the ACS/PCI population", and "a live-style note naming morphine (not in any tool result) falls back to the template".

Run `npx tsc -b`, `npx vitest run` and `npm run build`. Don't run git. List the files you changed. Afterward Claude re-tests Sarah and Dev live. If the stricter checks push the live agent into the template too often, Claude will send a prompt-tuning follow-up.
