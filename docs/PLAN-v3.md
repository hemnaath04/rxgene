# Hackachusetts (Oct 24, 2026): Biotech & Healthcare track plan — v3

> Changes from v2 are marked **[v3]**. The most important one is the de-escalation
> case in Layer 1, which was clinically wrong as written.

## Event facts (confirmed from the official schedule)

- Challenges and rules: 9:40–10:00 AM. **Re-read the Biotech track challenge and adjust the one-line pitch to use its wording.**
- Kiro walkthrough 10:00, kickoff 10:30, team formation 10:40–11:30.
- **Hacking starts 11:30 AM.** Submissions lock at 8:00 PM. Submit by 7:30.
- Maximum four people per team. Kiro is required for AI-generated code.
- Judging 8–11 PM, finalists announced around 11 PM.
- Finals: about 50 teams present at WHOOP headquarters, Sunday Oct 25, 11 AM–2 PM.
- Sponsors: AWS, Kiro, The Engine, WHOOP, SundAI Club; co-sponsors PwC and Stifel Venture Banking; state partners.
- **Assume most judges are not pharmacogenomics experts.** Expect venture investors, sponsor engineers and state officials.

## Verdict

Build RxGene, centered on drug-induced phenoconversion. A plain "genotype in, guideline out" tool already exists (PharmCAT, plus earlier hackathon projects), so phenoconversion is the core, not an add-on.

## The one-line pitch

> "Your genes don't change. Your prescriptions do. RxGene re-checks every time a medication is added, including when another drug makes a 'normal' patient process medicines like a poor metabolizer."

## The plain-language version (use the same words everywhere)

> "Your liver has a cleanup crew for medicines. Your DNA says how fast your crew works. Some drugs jam the crew. So your DNA says 'fast,' but your body is now 'slow.'"

Rules for talking about it:
- No gene names in the first 30 seconds.
- Introduce CYP2D6 once, as "the liver enzyme that handles many common drugs" (genetics teammate to confirm a share figure before using one).
- Say the consequence plainly: the painkiller won't work, or the drug builds up.

## Why this beats existing tools

| Tool | Patient: CYP2D6 \*1/\*1, on fluoxetine, adding codeine |
|---|---|
| Genotype report alone | Activity score 2.0 → normal metabolizer → standard codeine dosing. Green, no flag. Falsely reassuring. |
| Drug-interaction checker alone | Generic "fluoxetine–codeine interaction," often moderate severity, no phenotype, no specific action. |
| **RxGene** | Activity score 2.0 × 0 (strong inhibitor) = 0 → poor metabolizer → CPIC poor-metabolizer recommendation: avoid codeine, choose an alternative painkiller. |

**[v3] Second differentiator — alert de-escalation, stated correctly.**
Patient CYP2D6 \*4/\*4 (activity score 0, already a poor metabolizer) on fluoxetine, adding codeine.
The **codeine alert still fires** — a poor metabolizer should still avoid codeine.
What is de-escalated is the **fluoxetine–codeine interaction alert**, which a conventional
checker fires at the same severity as it would for a normal metabolizer. For this patient
the inhibitor adds nothing, because the enzyme was already absent.

- RxGene says: *"Avoid codeine (poor metabolizer). Note: fluoxetine adds no further effect — this patient was already a poor metabolizer by genotype."*
- RxGene must **not** say: "no additional effect from fluoxetine" with no codeine warning. That reads as reassurance and is wrong.

The story is "one precise alert instead of two blunt ones," not "fewer alerts."

## Clinical rules (from the genetics teammate)

**Phenoconversion convention:**
- Strong CYP2D6 inhibitor: activity score becomes 0, so the predicted phenotype is poor metabolizer.
- Moderate CYP2D6 inhibitor: activity score is multiplied by 0.5, then converted to a phenotype.
- Inhibitor strength (strong, moderate, weak) comes from FDA drug-interaction guidance.
- Sources: the CPIC opioid guideline (2021 update), genetic test interpretation section; the CPIC SSRI/SNRI guideline (2023, Bousman et al.) and its supplement; and Borges et al. for the method.

**Wording caveat:** this convention lives in CPIC background and supplement text, not in separate recommendation tables for phenoconverted patients.
- Say: "We apply CPIC's stated phenoconversion convention to select the matching phenotype recommendation."
- Don't say: "CPIC recommends X for this phenoconverted patient."

**Activity score thresholds (current CPIC/PharmVar standard — use these):**
- 0 = poor metabolizer
- Above 0 and below 1.25 = intermediate metabolizer
- 1.25 to 2.25 = normal metabolizer
- Above 2.25 = ultrarapid metabolizer
- One or two uncertain-function alleles = "indeterminate"

**Known discrepancy:** the 2019 CPIC atomoxetine supplement (and the 2015 SSRI supplement) used older thresholds. Use the current set, state it in the UI, and show a small note about the older convention. A judge who catches it will see it's already handled.

**[v3] Edge case — ultrarapid metabolizer plus a strong inhibitor.**
Applying the rule literally takes an activity score of 3.0 straight to 0. CPIC's own SSRI
supplement notes that ultrarapid metabolizers may not phenoconvert to the same extent.
So for any patient whose genotype phenotype is ultrarapid, output the converted phenotype
**with a reduced-confidence flag** rather than a hard poor-metabolizer alert. This is a
one-line rule and it is the kind of nuance a pharmacist judge will probe.

**[v3] Design decisions to state out loud (not hide):**
- More than one inhibitor on the list: apply the strongest only. Label this as a project design choice, not a CPIC rule.
- Inhibitor onset and washout are ignored; the model is steady-state. Say so in the limitations section of the README.

## Build plan in layers

Anything unfinished goes into the pitch as "what's next."

### [v3] Before 11:30 — prep that does not need code

Hacking starts at 11:30, but the allele table, inhibitor table and CPIC recommendation
table are inputs the rule engine needs at 11:30, not outputs of it. Build them during
team formation (10:40–11:30), or earlier.

- Allele → activity value table (\*1, \*2, \*4, \*5, \*10, \*17, \*41 is enough).
- Inhibitor → strength table: fluoxetine, paroxetine, bupropion, quinidine, terbinafine (strong); duloxetine, mirabegron (moderate).
- CPIC recommendation text by phenotype for codeine and atomoxetine.
- Confirm `https://api.cpicpgx.org/v1/` still responds before relying on it. CPIC and PharmGKB resources moved under ClinPGx, so check the host early, and keep a hand-typed JSON fallback.

### Layer 1: CYP2D6 end to end (11:30 AM – 2:00 PM) — must work

**[v3] Target 2:00, not 2:30.** The old plan put Layer 1 and the 2 PM test-output
deadline at the same moment, which left no time to act on a failed test.

- **Data (genetics teammate):** the three tables above, finalized.
- **Rule engine (CS):**
  1. Add the activity values of the two alleles.
  2. If a strong inhibitor is on the medication list, multiply by 0. If moderate, multiply by 0.5.
  3. Convert the score to a phenotype using the thresholds above.
  4. Look up the CPIC recommendation for that phenotype and drug.
  5. **[v3]** Emit both the genotype phenotype and the converted phenotype. The UI needs both, and the de-escalation case depends on comparing them.
- **UI (CS):**
  - A simulated order screen with an "Add medication" button.
  - An alert card with a **"clears this drug" gauge.** The genetic result stays "Normal" while the gauge slides to "Slow" when the inhibitor is present. This is the main demo visual.
  - An evidence drawer showing the guideline, version, evidence strength and link.
- **Output format:** shape the alert like a CDS Hooks card (the standard format for decision-support alerts inside hospital record systems), so "plugs into the EHR" is visible, not just claimed.
- **Demo cases:**
  1. Killer case: \*1/\*1 + fluoxetine + codeine → avoid codeine (converted poor metabolizer).
  2. **[v3]** De-escalation case: \*4/\*4 + fluoxetine + codeine → avoid codeine (genotype poor metabolizer), plus a note that fluoxetine adds no further effect.
  3. Clean case: "No supported alert" (not "safe"). Also show "Not assessed" and "Insufficient data" states.
- **Skills:** modeling data as JSON, small TypeScript functions, React state.
- **Concepts:** activity score, inhibitor multiplier, phenotype thresholds, "no alert is not the same as safe."

### [v3] 2:00–2:30 — test gate

Run the ~20 expected-output fixtures before any Layer 2 work starts. A failing rule
engine at 2:00 is cheap to fix; the same bug found at 5:30 costs the demo.
**Record a rough screen-capture backup video as soon as Layer 1 passes.** If deployment
fails later, you still have something to submit.

### Layer 2: AI layer + second direction + second gene (2:30 – 4:30 PM)

- **Plain-language patient summary:** the AI only rewrites the rule engine's output; it never decides. Keep a fixed template as a fallback. Run the model through AWS Bedrock.
- **Spanish summary:** nearly free once the summary works.
- **Atomoxetine case:** \*1/\*1 + fluoxetine + atomoxetine shows the opposite direction (drug builds up instead of failing). **[v3]** The CPIC atomoxetine recommendation for poor metabolizers is a dosing and plasma-concentration pathway, not a flat "avoid" — use the guideline's own wording, not "avoid."
- **Full medication-list check:** when a drug is added, re-check every drug on the list.
- **CYP2C19: clopidogrel + omeprazole.** Separate code path, because CYP2C19 maps straight from diplotype to phenotype with no activity score. Different harm: treatment failure and clot risk. Caution: this interaction is more clinically debated than the CYP2D6 cases, so expect pushback from a pharmacist judge. Build only after Layer 1 is solid.

### Layer 3: only if ahead (4:30 – 5:30 PM)

- PDF or text report upload with AI extraction, plus a clinician confirm step.
- A flag when guideline evidence is limited, including for underrepresented populations.
- A downloadable report for the patient or chart.

### Not building today

- DPYD (capecitabine/5-FU): its own scoring path with no phenoconversion angle. Keep it on one "what's next" slide as the most dramatic safety example.
- Warfarin and simvastatin: large scope, nothing new for the story.
- A chat follow-up feature: it puts the AI in a decision-adjacent role and weakens "AI never decides."
- Live 23andMe or VCF parsing: PharmCAT itself warns CYP2D6 calls from VCF files are unreliable.

### Wrap-up (5:30 – 7:30 PM)

- 5:30 feature freeze. Re-run all test fixtures against the genetics teammate's expected outputs.
- Deploy on AWS, record the final demo video, write the README (limitations, Kiro usage, data sources).
- Submit the SundAI card with the correct GitHub repo by 7:30.

## Architecture

```
Patient gene results + medication list (JSON for the demo; PDF upload is Layer 3)
  -> deterministic rule engine
       allele -> activity score -> inhibitor multiplier -> phenotype -> CPIC recommendation
       (emits BOTH genotype phenotype and converted phenotype)
  -> alert card (CDS Hooks shape) + gauge + evidence drawer
  -> clinician report + plain-language patient summary (AI rewrites, never decides)
```

- Stack: React/Vite/TypeScript front end, a small Node endpoint calling the model through Bedrock, rules as versioned JSON. No database. Synthetic patients only.
- CPIC data: pull tables once from the CPIC API and store as JSON. Don't call the API live during the demo.
- Build in Kiro and push to GitHub regularly.

## Kiro spec (safety rules written before code)

Write these in Kiro's requirements file and show it on one slide next to the alert it produced.

- WHEN the patient's CYP2D6 activity score is 2.0 AND they take a strong CYP2D6 inhibitor AND codeine is added, THE SYSTEM SHALL show a poor-metabolizer alert with the CPIC citation.
- **[v3]** WHEN the patient's genotype phenotype is already poor metabolizer AND an inhibitor is present, THE SYSTEM SHALL still show the drug-level alert for that phenotype AND SHALL state that the inhibitor adds no further effect.
- **[v3]** WHEN the genotype phenotype is ultrarapid metabolizer AND a strong inhibitor is present, THE SYSTEM SHALL show the converted phenotype with a reduced-confidence flag.
- WHEN no rule matches, THE SYSTEM SHALL show "No supported alert" AND SHALL NOT show "Safe."
- THE SYSTEM SHALL NOT allow the AI component to decide whether an alert appears.

Pitch line: "We wrote every safety rule as a spec in Kiro before writing code, so every alert traces back to a rule a clinician can read."

## UI language

| Technical term | What the UI says |
|---|---|
| Poor metabolizer | Clears this drug: Slow |
| Phenoconversion alert | Another medicine changed how this patient's genes work |
| Diplotype | Gene result |
| No supported alert | No supported alert (not the same as safe) |

Technical terms live in the evidence drawer.

## Who owns what

- **Genetics teammate (Ananya):** allele and inhibitor tables **(before 11:30)**, CPIC recommendations, expected outputs for about 20 test patients **(by 2:00)**, clinical-accuracy review, and the science part of the pitch — tonight and Sunday.
- **CS teammates:** rule engine, order screen, alert card, gauge, evidence drawer, AI summary, deployment, Kiro spec, demo video.

**[v3] Answered — no longer open questions:**
- **Who uses this in practice:** primarily the **pharmacist**. At UF Health, phenoconversion is handled manually by pharmacists writing clinical consult notes into the EHR — that is the workflow being automated. Prescribers are the second audience, via the CDS Hooks card.
- **Massachusetts program to name:** **Brigham and Women's Hospital Pharmacogenomics Clinic**, part of the Brigham Genetics & Genomic Medicine Service — a collaborative practice of a medical geneticist, a PGx-trained clinical pharmacist and a genetic counselor. Use as the "first customer" slide.
- **Prior art to acknowledge before a judge raises it:** the **UF Health CYP2D6 Phenoconversion Calculator** already exists. Difference: it is a manual, single-gene, one-drug calculator. RxGene takes a full medication list, re-checks on every change, emits a CDS-shaped alert, and generates the clinician note and patient summary.

## Pitch

### 30-second version (walk-up judges)

1. "Sarah's DNA test says she processes painkillers normally."
2. "She's on fluoxetine (an antidepressant), which jams her liver's cleanup crew, so her body now acts 'slow.'"
3. "Her doctor adds codeine. Her genetic report says fine. The interaction checker gives a vague warning."
4. "RxGene says codeine likely won't relieve her pain, and points to the guideline."
5. "Your genes don't change. Your prescriptions do."

### 60–90 second demo script (video and tonight's judging)

1. **0–10 s, hook:** Sarah's story in one sentence. No gene names.
2. **10–20 s:** Open Sarah's chart. Gene result: Normal. Current medications include fluoxetine (an antidepressant).
3. **20–40 s:** Click "Add medication," choose codeine. The gauge slides from Normal to Slow. Alert: "Codeine likely won't relieve pain for this patient; consider an alternative."
4. **40–50 s:** Show the comparison: the genetic report alone says green, the interaction checker alone says vague. Only RxGene combines both.
5. **50–60 s:** Open the evidence drawer: guideline, version, link. Flash the Kiro spec line behind the alert.
6. **60–75 s:** De-escalation case: a patient who was already "slow" still gets the codeine warning, but one precise alert instead of two blunt ones.
7. **75–90 s:** Show the plain-language patient summary (and Spanish if built). Close: "Your genes don't change. Your prescriptions do."

### 3-minute version (Sunday finals)

1. The person: Sarah's story (20 s).
2. The gap: the genetic report and the interaction checker each miss half the picture (20 s).
3. The scale: the share of patients on an inhibitor (verified stat below) (15 s).
4. Live demo: killer case, de-escalation case, patient summary (75 s).
5. How it's built safely: Kiro spec, deterministic rules, AI only explains (20 s).
6. Path to real use: CDS Hooks format, pharmacist-first workflow, Brigham PGx clinic, regulatory framing (20 s).
7. What's next: CYP2C19, DPYD, PDF ingestion (10 s).

## Judge-specific angles

- **Kiro:** show the requirements file driving the safety logic.
- **AWS:** model through Bedrock, deployed on AWS.
- **The Engine and venture judges:** why existing tools miss this, who would use it, CDS Hooks integration, and the evidence drawer's fit with FDA criteria for clinical decision support that isn't a regulated device (the clinician can review the basis for every alert). Present this as design intent, not a legal claim.
- **State officials:** one line tying it to the Massachusetts healthcare and biotech ecosystem (only something the team can back up).
- **WHOOP (Sunday host):** no forced wearable tie-in; make the patient summary polished.

## Questions judges will ask

- **"Doesn't the drug-interaction checker already catch this?"** It gives a generic warning with no phenotype and no specific action. It can't tell a normal patient who's been converted from one who was already a poor metabolizer. We combine the gene result and the drug list, so we escalate when it matters and give one precise alert instead of two blunt ones when it doesn't.
- **"What if the AI is wrong?"** The AI never decides. Written, versioned rules decide, and the Kiro spec shows each one. The AI only rewrites the result in plain language.
- **"Is this CPIC's recommendation?"** We apply CPIC's stated phenoconversion convention to select the matching phenotype recommendation.
- **"Your thresholds don't match the 2019 atomoxetine guideline."** Correct; we use the current standardized thresholds and flag the older convention in the UI.
- **"Is green 'safe'?"** No. The app separates "no supported alert," "not assessed" and "insufficient data."
- **"Doesn't PharmCAT or GeneSight do this?"** They interpret a genotype once. We re-check at every medication change and account for drug-induced phenoconversion.
- **[v3] "Doesn't UF Health's phenoconversion calculator already do this?"** It's a manual single-gene, single-drug lookup. We take the full medication list, re-check on every change, and emit an EHR-shaped alert with a clinician note and patient summary.
- **[v3] "What about an ultrarapid metabolizer on a strong inhibitor?"** We apply the convention but flag reduced confidence, because CPIC notes ultrarapid metabolizers may not phenoconvert to the same extent.
- **[v3] "What about timing — how long until the inhibitor takes effect?"** Out of scope today. The model is steady-state, and that limitation is written in the README.
- **"Who pays?"** Health systems and pharmacies that already hold PGx results, with the pharmacy team as the first user.

## Stats

**Use (verified):**
- 99.5% of 487,409 UK Biobank participants carry a variant that may change their response to at least one drug; nearly 24% have been prescribed such a drug. McInnes et al., *Clin Pharmacol Ther* 2020.

**Use after verifying the exact citation:**
- Roughly 20–30% of people in settings where CYP2D6 genotype might be used also take an inhibitor that causes phenoconversion; integrating phenoconversion is not yet standard of care, and most clinicians have limited knowledge of which drugs cause it. Source: PMC8404400. Pull the exact citation before it goes on a slide.
- Five of the ten FDA-classified strong or moderate CYP2D6 inhibitors (including fluoxetine, paroxetine, bupropion, duloxetine, mirabegron) appear on the 2021 "Top 300 Drugs" list. Same source; verify before use.
- FDA capecitabine and 5-FU label updates for DPD deficiency: pin the exact date before using on the "what's next" slide.

**Use with a label:**
- The Sciforum paper (LLM with CPIC retrieval failed to account for phenoconversion) is a preprint. Say so.
- Kiro team "AI proposes, deterministic code decides": verify the exact wording before quoting it in front of Kiro judges.

**Don't put on slides:**
- The CDC emergency-visit figure (2004–05 data).
- "Almost no one's results get used when prescriptions change" (unsourced; replaced by the 20–30% stat).

## Don't

- Don't claim a lab partnership you don't have.
- Don't call PharmGKB's old API. It is now ClinPGx (clinpgx.org).
- Don't parse 23andMe or VCF files live.
- Don't rank the "best therapy." Only report guideline-backed flags.
- Don't say "CPIC recommends X for this phenoconverted patient."
- **[v3]** Don't let any card imply a drug is acceptable because an interaction was de-escalated. De-escalation applies to the interaction alert, never to the drug-level recommendation.

## [v3] Pre-pitch verification checklist

Someone opens the actual PDFs at cpicpgx.org and confirms, before anything goes on a slide:

- [x] Activity score thresholds (0 / <1.25 / 1.25–2.25 / >2.25) — CPIC opioid guideline, genetic test interpretation section *(found in the guideline's Table 1, background section; source-matched 2026-10-24)*
- [x] Phenoconversion wording: strong → score 0, moderate → × 0.5 *(CPIC opioid guideline 2021; source-matched 2026-10-24)*
- [x] Codeine recommendation text for poor metabolizers *(matches CPIC 2021 Table 2 and the API; source-matched 2026-10-24)*
- [x] Atomoxetine recommendation text for poor metabolizers (dosing pathway, not "avoid") *(CPIC 2019 PDF, fixed-dose table, rated Moderate; source-matched 2026-10-24)*
- [x] Allele activity values for every allele in the demo patients *(match the CPIC API; source-matched 2026-10-24)*
- [x] The 20–30% phenoconversion statistic, read in the source paper, not a summary *(Cicali et al. 2021, PMC8404400; a reported figure citing recent studies; source-matched 2026-10-24)*

*Ticked by Claude on 2026-10-24 after string-matching each source. This is not human verification, except for six FDA inhibitor rows checked by Ananya. See docs/SCIENCE.md.*

## After the event

- @SiliconSnark offered to write about Hackachusetts projects for a general audience (siliconsnark@gmail.com). Send the demo link, screenshots and README, with synthetic data only.
