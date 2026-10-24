# Hackachusetts (Oct 24, 2026): Biotech & Healthcare track plan

## Verdict: GO, with changes

Build Idea A (pharmacogenomics), but in a narrower form. Drop Idea B (pedigree).
Codex gave the verdict "GO WITH CHANGES" on its own. Gemini's research found that a
plain CPIC lookup tool is redundant and that the winning edge is drug-drug-gene
phenoconversion.

## The one-line pitch

> "Your genes don't change, but your prescriptions do. RxGene re-checks a patient's
> existing PGx results every time a medication is added, including when another drug
> makes a normal metabolizer behave like a poor one."

## Why this version

- A plain "genotype in, CPIC advice out" bot already exists. PharmCAT (Stanford/NIH)
  does it end to end, and hackathon versions exist too: POPGx won Pitt Challenge 2022,
  and PGx-Guardian was built at an Auth0 hackathon. Judges at The Engine's Tough Tech
  Week will know this.
- **Phenoconversion is the distinctive part.** Example: a patient is genetically a
  CYP2D6 normal metabolizer, but they take fluoxetine, a strong CYP2D6 inhibitor, so
  they act like a poor metabolizer. Genotype-only tools miss this, and it is the honest
  answer to "why does this need an agent?"
- It shows judges both sides: deterministic, cited rules for safety, and AI for messy
  input and plain-language explanation.
- It fits the field. The other biotech ideas on the brainstorm board are a sepsis
  wearable, a triage chatbot, a PT coach and a medication-reminder app. None of them
  involves genetics, so the genetics teammate's expertise is a real advantage.

## Scope (keep it tight)

**Setting:** an outpatient pre-prescription check, run when a clinician adds or changes
a medication.

**Gene-drug pairs (all CPIC):**
- CYP2D6: atomoxetine, paroxetine, vortioxetine, codeine, tramadol
- CYP2C19: citalopram/escitalopram, clopidogrel
- DPYD: capecitabine/5-FU. This is the "why now" hook. The FDA updated these labels in
  2025–26 to say DPD-deficiency testing should be considered before treatment.

**Phenoconversion rule:** support only the cases CPIC states explicitly, starting with
fluoxetine or paroxetine combined with a CYP2D6 substrate. Do not invent general
adjustment rules.

**Three demo cases:**
1. Genotype-only alert: a CYP2C19 poor metabolizer about to get clopidogrel.
2. Phenoconversion alert: a CYP2D6 normal metabolizer on fluoxetine, adding atomoxetine
   or codeine. The alert appears even though the genotype is "normal."
3. Clean check that says "No supported PGx alert", which is not the same as "safe."
   Also show the "Not assessed" and "Insufficient data" states.

## Architecture

```
Upload (JSON/CSV or one text-PDF layout)
  -> AI extraction (LLM) -> clinician CONFIRMS parsed diplotypes against highlighted source
  -> deterministic rule engine (diplotype -> phenotype -> CPIC rule, + inhibitor check)
  -> alert card + evidence drawer (guideline, version, strength, link)
  -> clinician report + plain-language patient summary (LLM explains, never decides)
```

- Stack: React/Vite/TS front end, a small Node endpoint for the LLM, and the rules as
  versioned JSON. No database. Synthetic patients only.
- Data: the CPIC API is live and free at `https://api.cpicpgx.org/v1/` (check
  `pair_view`). Pull the tables once and store them in a JSON file. Don't call the API
  live during the demo.
- Build in **Kiro** (required) and push to GitHub regularly.

## Who owns what

- Genetics teammate: the rule tables, diplotype-to-phenotype mapping, phenoconversion
  cases, clinical-accuracy review, and the pitch's science.
- CS teammates: the rule engine, the UI (order screen, alert, evidence drawer),
  extraction, reports, and deployment.

## Timeline (confirm the start time at kickoff; the two event pages disagree)

| Time | Deliverable |
|---|---|
| Hacking start, first hour | Split roles; rule JSON for 2 pairs; skeleton UI |
| +1 h | First end-to-end case (clopidogrel) |
| +2 h | Phenoconversion alert working |
| +3 h | Upload + extraction + confirm step; unsupported-input handling |
| +4 h | Evidence drawer + clinician/patient reports |
| +5 h | Remaining pairs, DPYD case; LLM explanation with template fallback |
| ~5:30 PM | Feature freeze. Run ~20 test fixtures; genetics teammate reviews every output |
| 6–7:30 PM | Deploy, record a 60–90 s demo video, write the README (limitations + Kiro usage) |
| by 7:30 PM | Submit the SundAI card with the correct GitHub repo. Don't wait until 7:59 |

## 60-second demo script

1. 0–10 s, hook: "Over 99% of people carry at least one gene variant that changes how
   they respond to a common drug. Almost no one's results get used when prescriptions
   change."
2. 10–25 s: upload the patient's PGx report, then confirm CYP2D6 \*1/\*1 (normal).
3. 25–40 s: the patient is already on fluoxetine. Add atomoxetine. A phenoconversion
   alert appears next to the unchanged "normal" genotype.
4. 40–50 s: open the evidence drawer, which shows the exact CPIC guideline, its strength
   and a link.
5. 50–60 s: show the patient-friendly summary. Close with "Existing genetics, reconciled
   at the moment of prescribing."

## Questions judges will ask, and answers

- **"What if the AI is wrong?"** The AI never makes the recommendation. A
  deterministic, versioned rule engine with citations does. The AI only extracts data
  (which a clinician confirms) and explains the result.
- **"Doesn't PharmCAT or GeneSight already do this?"** They interpret a genotype once.
  We re-check it at every medication change and account for drug-induced
  phenoconversion. We're lab-independent.
- **"Is green 'safe'?"** No. The app separates "no supported alert", "not assessed" and
  "insufficient data."
- **"Who pays?"** Health systems and pharmacies that already hold PGx results. It's
  clinician decision support. The next step is FHIR/CDS Hooks integration into the EHR.

## Verified stats for slides

- 99.5% of 487,409 UK Biobank participants carry a variant that may change their
  response to at least one drug. Nearly 24% have been prescribed such a drug. Source:
  McInnes et al., *Clin Pharmacol Ther* 2020.
  https://www.ukbiobank.ac.uk/publications/pharmacogenetics-at-scale-an-analysis-of-the-uk-biobank/
- CDC estimates more than 700,000 US emergency department visits per year for adverse
  drug events (older 2004–05 data). A newer estimate is about 1 in 250 Americans per
  year (2013–14). https://www.cdc.gov/medicationsafety/program_focus_activities.html
- FDA updated the capecitabine and 5-FU labels for DPD deficiency in 2025–26.
  https://www.targetedonc.com/view/fda-updates-safety-labels-for-capecitabine-5-fu
- Tempus launched its OneOme 27-gene PGx test nationally on July 22, 2026. This shows
  the market is active.
  https://www.tempus.com/news/pr/oneome-pharmacogenomics-national-launch-2026/

## Evidence for the phenoconversion angle (use in the pitch)

- An LLM given CPIC guidance through retrieval (GPT-4.5) **could not account for
  phenoconversion** when it interpreted PGx reports (Sciforum preprint). This shows why
  that check has to be deterministic code, not the LLM.
  https://sciforum.net/paper/24984
- Frontiers in Genetics (2026): "The potential role of large language models in
  addressing phenoconversion in pharmacogenomics."
  https://www.frontiersin.org/journals/genetics/articles/10.3389/fgene.2026.1987469/full
- Frontiers also has an open research topic, "Pitfalls in Genotype-Based Personalized
  Therapy: Phenoconversion…" (manuscripts due Dec 2026), so this is an active research
  area. https://www.frontiersin.org/research-topics/79754
- Kiro's own team posted on 2026-10-22 about the same design: "the model proposes,
  deterministic code" checks. Use the line "AI proposes, deterministic code decides" to
  tie the project to the sponsor's thinking.

## X chatter (checked 2026-10-23)

- Almost no public posts about Hackachusetts yet, and nothing about challenges or judges.
- @SiliconSnark offered to write about Hackachusetts projects for a general audience
  (siliconsnark@gmail.com). This is free press for a finalist.

## Don't

- Don't claim a lab partnership you don't have.
- Don't call PharmGKB's old API. It is now ClinPGx (clinpgx.org).
- Don't parse 23andMe or VCF files live. PharmCAT itself warns that CYP2D6 calls from a
  VCF are unreliable.
- Don't rank the "best therapy." Only report guideline-backed flags.
