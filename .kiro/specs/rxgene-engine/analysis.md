# Analyze Requirements: findings and decisions

**Spec analyzed:** `.kiro/specs/rxgene-engine/requirements.md` (R1-R56), checked against `.kiro/steering/clinical-rules.md`.

**How it was run:** `kiro-cli chat --mode spec --no-interactive` with Claude Sonnet 5.5 on 2026-10-24, read-only. The IDE's Analyze Requirements button and the `/spec` slash command are not available in headless mode (the CLI said `/spec` is not a documented command), so this is Kiro's spec-mode analysis run by prompt, not the IDE button. Kiro's findings below are verbatim, apart from the added **Decision** lines.

**Decision key:** `fixed (Rxx changed)`, `not a problem because ...`, `known limitation (README or SCIENCE.md)`, or `OPEN` (needs a decision, usually because the fix changes engine behavior or adds fixed text).

**Summary:** 42 findings. 27 fixed (wording or consistency only, no behavior change, R numbers stable). 3 partly fixed (#3, #5, #34). 2 not a problem (#27, #42). 5 known limitations (#32, #36, #37, #39, #41). 5 OPEN, needing a decision (#1, #8, #21, #31, #33).

---

I read `requirements.md` (R1–R56, with R23 removed) against `clinical-rules.md`. I also used the README, `tech.md` and `structure.md` from context for cross-document checks. I did not open the `data/` files or the CPIC and FDA sources, so findings about data contents are based on what the requirements say. No files were edited.

Severity is tagged [H] high, [M] medium or [L] low.

## Conflicts between requirements

1. [H] **R18 hides the alert for a poor metabolizer on a moderate inhibitor.** (R18, R21, R19, R32)
   - R21 says a genotype-PM with any inhibitor must still get the drug-level alert. R18 says atomoxetine with a moderate inhibitor is GREY "Not assessed" with no adjusted score. For a PM, a moderate inhibitor changes nothing, so GREY would hide a real genotype alert.
   - R18's text says "the genotype-based result remains available", but no requirement says it is shown.
   - Fix: add precedence. Compute the genotype result first. R18 then only adds the "adjustment not assessed" flag when the genotype is not already PM. Require the genotype recommendation to be shown alongside the R18 text.

   **Decision (Ananya, 2026-10-24):** OPEN (real conflict, behavior change). For a genotype poor metabolizer on atomoxetine plus a moderate inhibitor, R18's GREY could hide the genotype alert that R21 requires. Not changed here because the fix changes engine behavior and needs a fixture (for example *4/*4 + duloxetine + atomoxetine). Proposed: compute the genotype result first, show it, and add the R18 'adjustment not assessed' flag. Needs Ananya's decision, then a brief for Mithuna.

2. [H] **R31 picks GREEN from recommendation content, but R29 and R30 forbid that.** (R31, R29, R30, clinical-rules "Alert levels")
   - R31 says "WHEN a CPIC recommendation indicates standard dosing… THE SYSTEM SHALL assign GREEN". That is inference from the content. The steering file and R29/R30 say the level comes only from `alert_levels.json`.
   - Fix: reword R31 to "WHEN the matched `alert_levels.json` entry is GREEN, THE SYSTEM SHALL display…".

   **Decision (Ananya, 2026-10-24):** fixed (R31 changed): the GREEN trigger is now the matched alert_levels.json entry, not recommendation content.

3. [H] **R17 never says how its alert level is chosen.** (R17, R29, R30, R26)
   - The lead text is the FDA label, which is not a CPIC row. R29/R30 would then find no `alert_levels.json` entry and produce GREY plus a data error, or leave the level undefined.
   - R26 says to key by "activity score (genotype or adjusted)". R17 sets the adjusted score to "n/a" and R18 never computes one, so the "or adjusted" branch is dead. It is also unclear which row supplies the CPIC "supporting" poor-metabolizer text.
   - Fix: state the alert level for R17 explicitly, and add an `alert_levels.json` entry for the FDA-label path. Define the supporting lookup as "AS = 0 row, adults". Remove "or adjusted" from R26.

   **Decision (Ananya, 2026-10-24):** partly fixed (R26 changed): 'or adjusted' removed. STILL OPEN: state R17's alert level (the engine takes it from the atomoxetine adults 0.0 row, YELLOW, fixture P13) and which row supplies the supporting CPIC text. One clause to add after a decision.

4. [H] **R19 says "ALWAYS" emit an adjusted phenotype, but several rules can't.** (R19, R17, R18, R7, R8)
   - R18 says the adjusted phenotype "has not been determined". R17 uses a non-phenotype string. R7 and R8 have no genotype phenotype at all.
   - Fix: add explicit exceptions in R19 ("except R7, R8, R18; for R17 use the R17 description"). Define the display value when the adjusted phenotype is undetermined.

   **Decision (Ananya, 2026-10-24):** fixed (R19 changed): explicit exceptions for R7, R8, R18 and R17.

5. [H] **R7 contradicts itself.** (R7, R32, clinical-rules "Lookups")
   - R7 says "assign the phenotype 'Indeterminate'" and also "SHALL NOT assign any CYP2D6 metabolizer phenotype". R32 and R8 call these "status/labels", not phenotypes. clinical-rules says "Indeterminate / Not assessed" as if they were one thing, while its last section says there are three separate states.
   - R7 is also one long sentence with about seven SHALL NOTs, which is hard to test.
   - Fix: make "Indeterminate" a status, not a phenotype. Split R7 into separate requirements (status, no partial score, no recommendation, fixed text). Fix the clinical-rules bullet to say "Indeterminate (R7) / Insufficient data (R8)", with Not assessed kept separate.

   **Decision (Ananya, 2026-10-24):** partly fixed (R7 changed): 'Indeterminate' is now a status, not a phenotype, and the structural cases are routed to R7. R7 stays one requirement to keep numbers stable. The wording in .kiro/steering/clinical-rules.md ('Indeterminate / Not assessed') is a steering file owned by the team: tell Hemnaath.

6. [M] **R20 isn't limited to codeine and tramadol.** (R20, R10, R14, R17, R41, clinical-rules "Phenoconversion")
   - clinical-rules scopes the UM-plus-strong-inhibitor rule to codeine and tramadol. R20 says "a strong CYP2D6 inhibitor" for any drug and "compute… per R10 and R14", which would apply a multiplier to atomoxetine and conflict with R17 and R41.
   - Fix: scope R20 to codeine and tramadol.

   **Decision (Ananya, 2026-10-24):** fixed (R20 changed): scoped to codeine and tramadol, as clinical-rules.md says.

7. [M] **R20 leaves the alert level open when two recommendations are shown.** (R20, R29)
   - The converted and the UM recommendation may map to different levels.
   - Fix: say which level governs, for example the higher severity, and that both are displayed.

   **Decision (Ananya, 2026-10-24):** fixed (R20 changed): the higher-severity alert level governs the card; both recommendations are displayed.

8. [M] **R32 gives no label for the "no alertLevel entry" case.** (R32, R30)
   - R32 says "also WHEN no alertLevel entry exists" but doesn't say whether that case is labelled "Not assessed". R32 also lists atomoxetine with a moderate inhibitor as a drug "the engine does not cover", which is wrong, since atomoxetine is covered. R32 packs three states, a GREY rule and a data-error rule into one sentence.
   - Fix: split R32. Give the data-error GREY its own label and text.

   **Decision (Ananya, 2026-10-24):** OPEN (new fixed text). The 'no alertLevel entry' data-error case needs its own label and text, and R32's atomoxetine example is stale because R18 covers it. Needs a decision on the text.

9. [M] **R35's checks don't match the README or R33.** (R35, R33, README "Design rule")
   - The README says the summary is validated for "same drug, same action, every dose kept, no new drugs or numbers, never 'safe'". R35 has no "never safe" check and no "every dose kept" check. R35 only forbids numbers that aren't in the input.
   - R35 also defines "preserves the alert action" only for RED ("avoid").
   - Fix: add the missing checks to R35, and define the preserved action for YELLOW, GREY and GREEN.

   **Decision (Ananya, 2026-10-24):** fixed (R35 changed): added the no-unsafe-wording, every-dose and per-level action checks.

10. [M] **R35 and R50 treat digits differently.** (R35, R50, R49)
    - R50 exempts gene, allele and requirement identifiers such as "CYP2D6", "*4" and "R10". R35 doesn't. A plain-language summary that says "CYP2D6" would fail unless the input contains those digits. R35's "drug not in the input" is also looser than R49's "on the list, being added, or in a returned recommendation text". It is unclear whether "input" includes the recommendation text.
    - Fix: share one number rule and one drug rule across R35 and R50. Define "input" explicitly.

   **Decision (Ananya, 2026-10-24):** fixed (R35 and R50 changed): identifiers and verbatim fixed texts are exempt from the number rule in both.

11. [M] **R38 conflicts with the GREY states.** (R38, R7, R8, R18, R17)
    - "WHEN issuing any alert" requires CPIC guideline, strength, URL and verbatim recommendation text. GREY alerts have no recommendation. R7 explicitly forbids showing one. R17 leads with FDA label text, which has no CPIC strength.
    - Fix: scope R38 to alerts that carry a recommendation. Define separate evidence fields for FDA-label and label-note sources, and for GREY cards.

   **Decision (Ananya, 2026-10-24):** fixed (R38 changed): scoped to alerts that carry a recommendation; FDA-label-led alerts show the label source instead of a CPIC strength.

12. [M] **R38 is badly formed and holds data content.** (R38)
    - It is a run-on sentence that includes a broken clause ("and that the recommendation wording differs…") and hard-codes example clopidogrel wording into the requirement. That wording can go stale and belongs in fixtures.
    - Fix: split into (a) metadata fields, (b) verbatim and unshortened text, and (c) preserve conditions. Move the PM and IM wording examples to the test fixtures.

   **Decision (Ananya, 2026-10-24):** fixed (R38 changed): split into clauses (a) to (f). The hardcoded clopidogrel wording was removed from the requirement; it lives in fixtures P17 and P18.

13. [M] **Fixed texts in R17, R18 and R28 need to survive R47 and R50.** (R47, R50, R55, R56, R17, R28, R21)
    - R56 requires the note to keep fixed texts such as "Different guidance contexts" (it contains "4-week" and "2-week"). R50 allows only numbers that appear in a tool result, and R47 requires a citation for each fact. This works only if `check_drug` returns those fixed texts.
    - Fix: require `check_drug` to return every fixed text and qualifier. Also say that fixed texts are exempt from the R35 and R50 number checks, or else are always taken from tool output.

   **Decision (Ananya, 2026-10-24):** fixed in the spec (R50 changed): verbatim fixed texts are exempt. STILL TO CONFIRM with Mithuna (brief 12): check_drug must return every fixed text and qualifier.

14. [M] **R39 and the closing line are inconsistent.** (R39, final line, R23)
    - R39 covers "R1–R56" but R23 is removed. The last sentence, "Every alert card… displays the requirement number(s)", sits outside any numbered requirement and is not in EARS form. It duplicates R39.
    - Fix: delete the trailing sentence and keep R39. Say "R1–R56 excluding R23".

   **Decision (Ananya, 2026-10-24):** fixed (R39 changed): range is R1-R56 excluding the removed R23; the stray closing sentence was deleted.

## Ambiguities

15. [M] **R1 to R2: structural cases are not covered.** (R1, R2, R7, R8)
    - R1 requires "two alleles with known activity values". R2 handles duplications (`*1x2`). It is unclear whether duplicating an unknown allele is Indeterminate or an error, and whether a copy number over 2 or unparseable notation is Indeterminate.
    - Fix: state each case, or point them all to R7.

   **Decision (Ananya, 2026-10-24):** fixed (R7 changed): unparseable copy numbers, duplications of unknown alleles and malformed notation are Indeterminate.

16. [M] **A one-allele or malformed genotype fits neither R7 nor R8.** (R7, R8)
    - R8 covers only a result that is "missing or not provided". Nothing covers a single allele, three or more alleles, or a malformed string. "No activity value" is also ambiguous: it could mean a null in the data, an allele absent from the file, or a CPIC "uncertain function" allele.
    - Fix: define "no activity value" precisely. Route every other non-two-allele case to R7 or R8.

   **Decision (Ananya, 2026-10-24):** fixed (R7 changed): one-allele, three-or-more-allele and malformed genotypes route to R7; 'no activity value' is defined.

17. [M] **R13 is silent on ties and unclassified inhibitors.** (R13, R10–R12)
    - There is nothing on ties, on inhibitors with an unknown class, or on how drug names are matched (brand and generic, combination products). R13 also speaks of an "adjustment factor", but R10 for a strong inhibitor sets the score to 0, which isn't a factor.
    - Fix: define matching and tie-breaking, a rule for unknown class, and neutral wording such as "apply only the strongest class's adjustment".

   **Decision (Ananya, 2026-10-24):** fixed (R13 changed): neutral wording; an inhibitor not listed in inhibitors.json is not treated as an inhibitor. Known limitation (SCIENCE.md): brand names and combination products are not matched; the lists use generic names.

18. [M] **R17 and R18 don't cover a weak inhibitor, or several inhibitors of the same class, for atomoxetine.** (R12, R17, R18)
    - R12 handles weak inhibitors only for codeine and tramadol. For atomoxetine with only a weak inhibitor, nothing is specified. R18's `{Inhibitor}` placeholder is undefined when several moderate inhibitors are present.
    - Fix: state the weak-inhibitor outcome for atomoxetine, and say how R18 names several inhibitors (for example list all of them).

   **Decision (Ananya, 2026-10-24):** fixed (R18 changed): several moderate inhibitors are all named; atomoxetine with only weak inhibitors gets no adjustment and is handled by genotype.

19. [M] **R26 mixes lookup by exact score and by range.** (R26, R44, R40)
    - It says "use the activity score as the lookup key", but the CPIC atomoxetine table is in ranges (for example 0.25–0.75). The claim "only quarter-step scores occur" is a rationale, not a requirement. The mapping of scores above 2.25 or other off-table values is not stated.
    - Fix: define the lookup as an exact row or a range, and list the rows that exist. Say what happens when no row matches (R30 or R32).

   **Decision (Ananya, 2026-10-24):** fixed (R26 changed): exact row or containing range; no match goes to R30 and R32.

20. [M] **R40's trigger can't be tested.** (R40)
    - "WHEN a patient's case involves activity score thresholds that differ…" has no concrete condition. It is also the only note with no fixed text.
    - Fix: name the exact cases (for example any atomoxetine result at AS 1.0 or 1.25) and give the fixed note text.

   **Decision (Ananya, 2026-10-24):** fixed (R40 changed): the trigger is now any displayed atomoxetine assessment. STILL TO CONFIRM with Mithuna that the drawer shows the note for every atomoxetine assessment (seen only on P13 so far).

21. [M] **R22's trigger and output are vague.** (R22, R9, R28, R45)
    - "Inhibitor drug" doesn't say whether weak inhibitors count. "CYP2D6-related alerts" doesn't say which drugs. It doesn't say whether the output is only the changed alerts or all of them. Removing an inhibitor has no equivalent (R23 was dropped).
    - The same trigger is missing for omeprazole: adding omeprazole when clopidogrel is already on the list (see R28 below).
    - Fix: define the inhibitor classes that trigger it, the drugs re-checked, and the output. Cover omeprazole or state that it is out of scope.

   **Decision (Ananya, 2026-10-24):** OPEN (needs engine facts). Which inhibitor classes trigger the re-check and what exactly is re-shown must be confirmed with Mithuna before specifying. Wording not changed so as not to describe behavior we have not verified. Omeprazole-added-after-clopidogrel is a known gap.

22. [L] **R28 covers omeprazole only.** (R28)
    - The fixed text names "omeprazole or esomeprazole", but the trigger is "is also taking omeprazole". "Medication card" is used only here, while the rest of the spec says "card" or "alert card".
    - Fix: add esomeprazole to the trigger, or remove it from the text. Use one term for the card.

   **Decision (Ananya, 2026-10-24):** fixed (R28 changed): trigger stated as omeprazole only; esomeprazole is named in the label text but not modeled. Known limitation. 'Medication card' changed to 'alert card'.

23. [L] **R21's inhibitor note isn't marked as fixed text.** (R21)
    - The note text is quoted, and it uses an em dash and doesn't say which inhibitor. Elsewhere "exact fixed text" is stated explicitly. R21 also applies to any inhibitor, including a weak one, and the section is titled "De-escalation" although the alert is not lowered.
    - Fix: say "exact fixed text", add the inhibitor name, and rename the heading.

   **Decision (Ananya, 2026-10-24):** fixed (R21 changed): now says 'exact fixed text' with the inhibitor named, matching what the fixtures and engine produce (P02). Heading renamed 'Edge Cases: Confidence and Interaction Notes'.

24. [L] **R33's rule on the word "safe" is ambiguous.** (R33, R31, R35)
    - It covers 'safe' and 'seguro' but not "unsafe", "safety", "safely" or other languages. The UI has a `lang` URL parameter, but no requirement covers language or translation of the exact fixed texts. The allowed exception, 'not the same as safe', should be an exact-string allow-list. Otherwise the R35 validator would reject the GREEN text.
    - Fix: define whole-word versus substring matching, the language scope, and an allow-listed exact string. Add a requirement for localised fixed texts, or state they are English-only.

   **Decision (Ananya, 2026-10-24):** fixed (R33 changed): whole word list (safe, safely, safety, unsafe, seguro, seguridad) and exact allow-listed strings in English and Spanish. Checked: no UI or API string uses the newly banned words. Known limitation: fixed clinical texts are English-only; only the patient-summary template has a Spanish version.

25. [L] **R36's failure cases are narrower than R51's.** (R36, R51, tech.md)
    - R36 covers validation failure and a 6 s timeout, but not an HTTP error, an empty reply or a missing key. R51 covers "model call fails". The 6 s, 25 s and the 3 s CDS fallback in `tech.md` are separate timeouts and are not tied together anywhere.
    - Fix: say R36 applies to any LLM failure. Add a short table of the timeouts.

   **Decision (Ananya, 2026-10-24):** fixed (R36 changed): applies to any LLM failure. Not a problem for the separate timeouts (6 s summary, 25 s agent, 3 s CDS fallback): they are separate by design and listed in tech.md.

26. [L] **R47's list of facts doesn't match R56.** (R47, R56)
    - R47 lists recommendation, alert level, phenotype, activity score and inhibitor class. R56 also requires the note to keep qualifiers (reduced confidence, population, inhibitor note), and the diplotype is a fact too. These are not in R47's list. A deterministic check of free text against tool results is also under-specified.
    - Fix: extend the list, and say how facts are matched, for example structured claims, to make "deterministic" feasible.

   **Decision (Ananya, 2026-10-24):** fixed (R47 changed): list extended to diplotype and qualifiers; the check matches structured claims against tool results.

27. [L] **R48 is subsumed by R55, and the verbs differ.** (R48, R55, R51)
    - R55 already requires every reviewed medication. R48 is only the RED/YELLOW subset. R51's Template list also omits R47, R49, R50 and R53, with no explanation for the exemption.
    - Fix: merge R48 into R55 or state the "keeping the action" check separately. State which rules the Template is exempt from and why.

   **Decision (Ananya, 2026-10-24):** not a problem: R48 stays for stable numbering and R55 is the superset. The Template exemptions are now stated in R51.

28. [L] **R49 and R38 allow naming alternative drugs, against the product statement.** (R49, R38, product.md)
    - `product.md` says RxGene is "not a therapy recommender". R38 and R49 allow the note to name prasugrel or ticagrelor because the CPIC text does. Nothing says they may only be quoted as part of the verbatim text.
    - Fix: say alternatives may appear only inside quoted recommendation text.

   **Decision (Ananya, 2026-10-24):** fixed (R38 and R49 changed): alternative drugs may appear only inside quoted CPIC or FDA recommendation text.

29. [L] **R50 doesn't allow numbers the note itself adds.** (R50, R52, R55)
    - Counts ("3 medications reviewed"), dates and times in the note header, and truncated results in the trace (R53) would fail R50.
    - Fix: list the exempt number types (counts, timestamps, trace indices).

   **Decision (Ananya, 2026-10-24):** fixed (R50 changed): counts, header timestamps and trace indices are exempt.

30. [L] **R51's "8 tool-call rounds" is ambiguous.** (R51)
    - A round could mean one model turn, which may issue several parallel tool calls, or one tool call.
    - Fix: define it, for example "model turns that request tool calls".

   **Decision (Ananya, 2026-10-24):** fixed (R51 changed): a round is one model turn that requests tool calls; parallel calls in one turn count as one round.

## Gaps (missing requirements)

31. [H] **No requirement for the main flow.** (all)
    - Nothing says: WHEN the clinician adds a drug, THE SYSTEM SHALL check that drug against genotype and medications. R22 and R45 cover only the re-check and the consult. There is no rule for a drug outside the supported scope (silent, or a GREY "Not assessed" card on every medication such as lisinopril). R32's "drug the engine does not cover" and R45/R55 ("SHALL NOT omit the drug") together imply a GREY card for every unsupported drug.
    - Fix: add a requirement for the add-drug trigger. Say how unsupported drugs are shown, for example a collapsed "not covered" list.

   **Decision (Ananya, 2026-10-24):** OPEN (new requirement). Would add R57 for the add-drug flow and the display of drugs outside RxGene's scope. Describes existing behavior but also needs a UI decision. Needs Ananya's decision.

32. [H] **No requirement for LLM extraction or pharmacist confirmation.** (R34; README; product.md)
    - The README and `product.md` describe extraction from lab reports with human confirmation before the engine runs. R34 limits the AI only for alerts and summaries. Nothing forbids running the engine on unconfirmed extracted genotypes.
    - Fix: add a requirement that the engine uses only pharmacist-confirmed genotypes, that extraction output is flagged unconfirmed, and that the AI can't write directly to the genotype store.

   **Decision (Ananya, 2026-10-24):** known limitation (README): lab-report upload with AI extraction and pharmacist confirmation is not built (Layer 3). No engine path accepts unconfirmed genotypes today.

33. [H] **CYP2C19 has no missing-data, unsupported-allele or mapping rules.** (R7, R8, R27, R42)
    - R7 and R8 and their fixed texts name CYP2D6 only. For clopidogrel nothing says what happens when CYP2C19 is missing, indeterminate or has no phenotype mapping. The mapping from diplotype to phenotype and the phenotype names are not specified, whereas CYP2D6 has R3 to R6.
    - Fix: add CYP2C19 versions of R7 and R8 with their own texts, and a diplotype-to-phenotype requirement.

   **Decision (Ananya, 2026-10-24):** OPEN (behavior not specified). What happens when the CYP2C19 result is missing, uninterpretable or unmapped is unspecified, and the diplotype-to-phenotype mapping is our own coding of CPIC's convention (not yet cross-checked). Needs a decision, fixtures and a brief for Mithuna.

34. [M] **The clopidogrel indication limit is not enforced on the card.** (R27, R26, README "Limitations")
    - The README says the ACS/PCI indication must not be generalised. R26 requires the card to state the population for atomoxetine. R27 does not require it for clopidogrel, and R56 only requires it in the consult note.
    - Fix: require the card to show "Population: CVI ACS PCI" and an indication caveat.

   **Decision (Ananya, 2026-10-24):** partly addressed: the card already shows 'Population: CVI ACS PCI (CPIC)' (seen live) and the ACS/PCI limitation is now in the README and SCIENCE.md. A requirement for an explicit on-card indication caveat would add new fixed text: OPEN, decision.

35. [M] **Codeine and tramadol populations are unspecified.** (R24, R25)
    - R26 and R27 each name a population. R24 and R25 do not. If the CPIC data has adult and pediatric rows, the choice is undefined.
    - Fix: state the population, or state that the system is adult-only.

   **Decision (Ananya, 2026-10-24):** fixed (R24 and R25 changed): the CPIC rows are labeled 'general'.

36. [M] **No visible warning for the unmodelled CYP2C19 interaction.** (R42, R31, R28)
    - The README admits that a patient on fluoxetine (a strong CYP2C19 inhibitor per FDA) with clopidogrel gets no flag. A GREEN result labelled "genotype only" (R31) partly mitigates this, but only the omeprazole case is called out.
    - Fix: add a fixed on-card limitation note when a known CYP2C19 inhibitor is on the list, with no phenoconversion computed.

   **Decision (Ananya, 2026-10-24):** known limitation (README): CYP2C19 phenoconversion is not modeled; fluoxetine is a strong CYP2C19 inhibitor per FDA. OPEN decision: a visible on-card note would be a real safety improvement but needs new fixed text and an engine change.

37. [M] **No requirement for the reference-data schema.** (R29, R30, R44, R10–R13)
    - Nothing specifies how `alert_levels.json` is keyed (phenotype, score, "1.0 (*10 present)"). Nothing says that `inhibitors.json` has per-enzyme classes (fluoxetine is strong for both CYP2D6 and CYP2C19), or what the "data error" in R30 is (log, UI banner, fixed text).
    - Fix: add a data-integrity requirement covering the schema, a startup check, and the exact user-visible data-error text.

   **Decision (Ananya, 2026-10-24):** known limitation (low priority): the alert_levels.json header documents its keys; a startup integrity check is not built.

38. [M] **R44's row name and data source don't match the other documents.** (R44, clinical-rules, README)
    - R44 calls the row '1.0 (*10 allele present)'. clinical-rules and `alert_levels.json` use "1.0 (*10 present)". R44 says the source is the CPIC PDF. The README says "every recommendation is taken word for word from the CPIC API", which R44 contradicts. R44 also leaves the "*36 combination" notation undefined.
    - Fix: use one row name. Mark this row as PDF-sourced in the README and evidence drawer. Define how diplotypes are written.

   **Decision (Ananya, 2026-10-24):** fixed (R44 changed, README changed): one row name, '1.0 (*10 present)', diplotype notation stated; the README no longer claims every recommendation is word-for-word from the API.

39. [L] **The weak-inhibitor rule (R12) isn't in clinical-rules.** (R12, clinical-rules "Phenoconversion")
    - The steering file lists only strong (AS = 0) and moderate (× 0.5), and says "do not change without a source". R12 (no change, weak noted) has no cited source. I did not check CPIC 2021 for what it says about weak inhibitors.
    - Fix: cite the source for R12 in `clinical-rules.md`, or mark it a design choice as the README does for "strongest wins".

   **Decision (Ananya, 2026-10-24):** known limitation (SCIENCE.md, unverified row added): R12 (weak inhibitors get no adjustment) is carried over from the repo and is a design choice; the CPIC text on weak inhibitors was not opened. clinical-rules.md is a steering file: tell Hemnaath.

40. [L] **Document counts and numbering are out of date.** (README, tech.md, structure.md, R39, R44)
    - The README says "42 numbered EARS requirements (R1–R43)". The spec now has 55 active requirements in R1–R56. `tech.md` and `structure.md` say 22 fixtures; the README says 24 synthetic patients. R44 sits between R33 and R34, out of order.
    - Fix: update the README and steering counts. Move R44 into the Recommendation Lookup section or into numeric order.

   **Decision (Ananya, 2026-10-24):** fixed (README changed): requirement count 55 active (R1-R56), 25 fixtures. tech.md and structure.md still say 22 fixtures: steering files owned by the team, tell Hemnaath. R44 out of numeric order is not a problem: it stays in the Lookup section so numbers stay stable.

41. [L] **No requirement for the CDS Hooks / EHR-mode behaviour.** (tech.md)
    - `tech.md` makes EHR mode the default, with a 3 s fallback to the local engine. No requirement says the fallback gives identical results (the principle in R54), or what the user sees when it triggers.
    - Fix: add a requirement for result parity between the CDS endpoint and the local engine, plus a fallback indicator.

   **Decision (Ananya, 2026-10-24):** known limitation: parity between the CDS endpoint and the local engine is an engineering requirement, outside the science spec. Both use the same engine code (build spec section 3). Tell Mithuna.

42. [L] **Duplicate requirements.** (R15, R16, R24, R25, R41, R10–R12)
    - R15 and R16 restate that R10–R14 apply, although R10–R12 are already scoped to codeine and tramadol. R24 and R25 are identical apart from the drug name. R41 repeats the scope again. Several places to change means a risk of drift.
    - Fix: keep one scope statement (R41). Merge R15 and R16 into R10–R14. Merge R24 and R25.

   **Decision (Ananya, 2026-10-24):** not a problem: duplicate requirements stay so numbers stay stable. R41 is the single scope statement; merging would renumber.

