Model: claude-sonnet-4.5. Owner: Ananya. Target: 3:15 PM. Mithuna starts building from this draft at the same time, so keep the R numbers stable.

We're adding a **pharmacist consult agent**. A pharmacist clicks "Review full medication list". An LLM agent then calls our deterministic tools for every drug on the list and drafts the consult note a PGx pharmacist would write into the chart. This automates the manual workflow in docs/PLAN-v3.md (UF Health pharmacists writing phenoconversion consult notes by hand). The rule engine still decides everything; the agent only gathers tool results and writes them up.

Task: add requirements R45-R54 below to .kiro/specs/rxgene-engine/requirements.md, under a new heading "## Consult Agent". Keep them in EARS form (WHEN … THE SYSTEM SHALL …). Use your judgment on clinical wording, but don't weaken any constraint. If you add a requirement, number it R55 or higher, and tell Hemnaath so Mithuna's brief can cite it. Also update R39's range to R1–R54.

Draft:

**R45:** WHEN the pharmacist requests a medication-list review, THE SYSTEM SHALL run the consult agent over every medication on the patient's list, plus the drug being added if there is one.

**R46:** THE consult agent SHALL obtain clinical facts only by calling deterministic tools (get_patient, check_drug, list_inhibitors, get_evidence). check_drug SHALL return the rule engine's assessment unchanged. THE SYSTEM SHALL NOT give the agent any tool that creates, changes or suppresses an alert.

**R47:** WHEN the consult note states a recommendation, alert level, phenotype, activity score or inhibitor class, THE SYSTEM SHALL require that sentence to cite at least one tool call from the same run. A sentence that states such a fact without a valid citation SHALL fail validation.

**R48:** THE consult note SHALL address every drug the engine assessed as RED or YELLOW, keeping the engine's action for that drug ("avoid" for RED; a dose or titration adjustment for YELLOW).

**R49:** THE consult note SHALL NOT name any drug that is not on the medication list, is not the drug being added, and doesn't appear in a returned CPIC or FDA recommendation text.

**R50:** THE consult note SHALL NOT contain any number that does not appear in a tool result from the same run.

**R51:** WHEN the note fails validation (R33, R47-R50), OR the model call fails, OR the agent exceeds 8 tool-call rounds, OR the run exceeds 25 seconds, THE SYSTEM SHALL show a deterministic consult note built directly from the engine's assessments, labeled "Template".

**R52:** THE SYSTEM SHALL label every consult note "Draft — pharmacist review required" and SHALL NOT offer any action that sends, signs or files the note.

**R53:** THE SYSTEM SHALL display the agent's tool-call trace (tool name, arguments, short result) next to the note, and each citation SHALL link to the trace step it cites.

**R54:** THE consult agent SHALL NOT change, suppress or reorder the engine's alerts. THE alerts shown in the main view SHALL be identical whether or not the agent has run.

Also check: does R33 (never call anything safe) need to name the consult note explicitly? Add that if so.

Then commit only .kiro/specs/ to dev (`git pull --rebase origin dev` first) and push.
