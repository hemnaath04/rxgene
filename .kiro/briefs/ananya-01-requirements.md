Read docs/PLAN-v3.md (the "Kiro spec" and "Clinical rules" sections), .plans/rxgene-build-spec.md sections 1, 2 and 4, and .kiro/steering/clinical-rules.md.

Create the file .kiro/specs/rxgene-engine/requirements.md. Write ONLY requirements.md for now, in EARS format (WHEN … THE SYSTEM SHALL …). Number every requirement (R1, R2…) so the UI can show which one triggered an alert.

Cover at least:
- activity score sum and phenotype thresholds
- strong (x0), moderate (x0.5) and weak (no change) inhibitors; strongest-only when there are several
- codeine/tramadol computed; atomoxetine + strong uses the PM-equivalent recommendation; atomoxetine + moderate gives "pharmacist review"
- poor metabolizer + inhibitor: the drug alert still fires, plus the "adds no further effect" note
- ultrarapid metabolizer + strong inhibitor: reduced confidence
- adding an inhibitor re-checks drugs already on the list
- an unknown allele gives Not assessed; a missing gene result gives Insufficient data
- the word "Safe" is never shown
- the AI never decides whether an alert appears, and the AI summary is validated or falls back to a template
- clopidogrel is genotype-only (ACS/PCI); omeprazole is a separate label note

Do not write design or code. Stop after requirements.md so I can review it.
