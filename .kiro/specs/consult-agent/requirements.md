# Consult agent requirements

Consult agent requirements live in `rxgene-engine/requirements.md`, R45–R56. This file is a copy for the spec workflow (design and tasks). If a requirement changes, change it in `rxgene-engine/requirements.md` first and re-copy it here. The R-numbers match the engine spec and must not change.

---

**R45:** WHEN the pharmacist requests a medication-list review, THE SYSTEM SHALL run the consult agent over every medication on the patient's list, plus the drug being added if there is one.

**R46:** THE consult agent SHALL obtain clinical facts only by calling deterministic tools (get_patient, check_drug, list_inhibitors, get_evidence). check_drug SHALL return the rule engine's assessment unchanged. THE SYSTEM SHALL NOT give the agent any tool that creates, changes or suppresses an alert.

**R47:** WHEN the consult note states a recommendation, alert level, phenotype, diplotype, activity score, inhibitor class or qualifier (reduced confidence, inhibitor note, label note, population), THE SYSTEM SHALL require that sentence to cite at least one tool call from the same run. A sentence that states such a fact without a valid citation SHALL fail validation. A citation is valid only if it refers to a tool call from the same run AND that call's result contains the fact stated. Citations SHALL be checked by deterministic code, not by a model; the deterministic check matches structured claims against tool results.

**R48:** THE consult note SHALL address every drug the engine assessed as RED or YELLOW, keeping the engine's action for that drug ("avoid" for RED; a dose or titration adjustment for YELLOW).

**R49:** THE consult note SHALL NOT name any drug that is not on the medication list, is not the drug being added, and does not appear in a returned CPIC or FDA recommendation text; alternative drugs may appear only inside quoted CPIC or FDA recommendation text.

**R50:** THE consult note SHALL NOT contain any number that does not appear in a tool result from the same run. The following are exempt from this rule: counts of medications reviewed, timestamps in the note header, trace step indices (citation markers), gene and allele identifiers, requirement identifiers (for example CYP2D6, *4, R10), and fixed texts taken verbatim from tool output.

**R51:** WHEN the note fails validation (R33, R47–R50, R55–R56), OR the model call fails, OR the agent exceeds 8 tool-call rounds, OR the run exceeds 25 seconds, THE SYSTEM SHALL show a deterministic consult note built directly from the engine's assessments, labeled "Template". A round is one model turn that requests tool calls (parallel calls in one turn count as one round). The Template note contains no model text, so R47, R49 and R50 do not apply to it; R33, R48, R52, R53, R55 and R56 do.

**R52:** THE SYSTEM SHALL label every consult note "Draft — pharmacist review required" and SHALL NOT offer any action that sends, signs or files the note.

**R53:** THE SYSTEM SHALL display the agent's tool-call trace (tool name, arguments, short result) next to the note, and each citation SHALL link to the trace step it cites. The trace SHALL also be shown when the run fell back to the Template note (R51), up to the point of failure.

**R54:** THE consult agent SHALL NOT change, suppress or reorder the engine's alerts. THE alerts shown in the main view SHALL be identical whether or not the agent has run.

**R55:** THE consult note SHALL list every medication reviewed (R45) together with the engine's result for it, AND a medication with no check_drug result from the same run SHALL fail validation. WHEN the engine's result is GREY, THE note SHALL state the matching fixed text of R7, R8 or R18 unchanged AND SHALL NOT omit the drug. WHEN the engine's result is GREEN, THE note SHALL use the wording "No supported PGx alert (not the same as safe)", SHALL label it a genotype result only (R31), AND SHALL NOT state or imply that the medication list as a whole has been cleared.

**R56:** WHEN the engine's result for a drug carries a qualifier, THE consult note SHALL keep it: the genotype phenotype and the adjusted phenotype side by side (R19); the "reduced confidence" flag with both recommendations (R20); the inhibitor note for a patient who is already a poor metabolizer (R21); the FDA/CPIC "Different guidance contexts" text for atomoxetine (R17); the omeprazole–clopidogrel label note (R28); and the population used for atomoxetine and clopidogrel (R26, R27).
