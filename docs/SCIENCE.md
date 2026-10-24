# RxGene science traceability

Every clinical claim the app makes, the source it comes from, a short exact quote and the
date we checked the source. Quotes are under 15 words. Drafted 2026-10-24; not yet signed
off by Ananya.

**How to read the "Verified by" column**
- **Ananya (human)**: a person looked at the source and confirmed it. Only six FDA
  inhibitor rows have this (fluoxetine, paroxetine, bupropion, duloxetine, sertraline,
  omeprazole); the other inhibitors in that table are source-matched only.
- **Source-matched**: a subagent or Claude opened the source and string-matched the quote.
  This is NOT human verification. Treat it as "the quote exists", not "a clinician signed
  off".

## Source-matched (agent-checked)

| Claim used in app | Source | Short exact quote | Verified by | Date |
|---|---|---|---|---|
| **HUMAN-VERIFIED.** CYP2D6 strong inhibitors: fluoxetine, paroxetine, bupropion. Moderate: duloxetine. Weak: sertraline. Also omeprazole = CYP2C19 weak inhibitor (the clopidogrel label note, not a computed phenoconversion). Fluoxetine is also a strong CYP2C19 inhibitor. | FDA table of CYP enzyme interactions, page content current as of 2026-05-29. https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems | fluoxetine: "2C19; 2D6 strong inhibitor" | **Ananya (human, personally checked all six rows)** | 2026-10-24 |
| CYP2D6 inhibitor classes for the other drugs: strong (quinidine, terbinafine), moderate (abiraterone, cinacalcet, lorcaserin, mirabegron, rolapitant), weak (amiodarone, celecoxib, cimetidine, clobazam, cobicistat, escitalopram, fluvoxamine, labetalol, vemurafenib) | Same FDA table, same page date | e.g. abiraterone, CYP Mod INH column: "2D6 moderate inhibitor" | Source-matched (Claude parsed the page and compared it with `data/inhibitors.json`); NOT human-verified | 2026-10-24 |
| CYP2D6 activity-score thresholds: poor = 0, intermediate 0 < x < 1.25, normal 1.25–2.25, ultrarapid > 2.25 | CPIC opioid guideline 2021 (Crews et al.), Table 1. https://pmc.ncbi.nlm.nih.gov/articles/PMC8249478/ | "0<x<1.25" (intermediate row) | Source-matched | 2026-10-24 |
| A strong CYP2D6 inhibitor sets the activity score to 0 (codeine, tramadol only) | Same guideline, drug-drug interaction section | "activity score is adjusted to 0" | Source-matched | 2026-10-24 |
| A moderate CYP2D6 inhibitor multiplies the activity score by 0.5 (codeine, tramadol only) | Same guideline | "multiplied by 0.5" | Source-matched | 2026-10-24 |
| The ×0 / ×0.5 rule is not extended to other drugs, because the antidepressant guideline says no method is agreed | CPIC SSRI/SNRI guideline 2023 (Bousman et al.). https://files.cpicpgx.org/data/guideline/publication/serotonin_reuptake_inhibitor_antidepressants/2023/37032427.pdf | "have not been established" | Source-matched | 2026-10-24 |
| Ultrarapid metabolizers get a reduced-confidence flag with a strong inhibitor | Same SSRI/SNRI guideline | "may not undergo phenoconversion by paroxetine" | Source-matched | 2026-10-24 |
| Codeine, CYP2D6 poor metabolizer: avoid codeine | CPIC opioid guideline 2021, Table 2, and the CPIC API recommendation view | "Avoid codeine use because of possibility of diminished analgesia." | Source-matched | 2026-10-24 |
| Atomoxetine, strong CYP2D6 inhibitor: handled like a poor metabolizer, with a longer titration interval (label-based, not the opioid ×0 rule) | FDA STRATTERA label, section 2.5 (DailyMed set id 309de576-c318-404a-bc15-660c2b1876fb, version 69, published 2026-07-23) | "a longer titration interval of 4 weeks is recommended" | Source-matched (Claude, from the label XML) | 2026-10-24 |
| Atomoxetine, poor metabolizer: a dosing and plasma-concentration pathway, not "avoid" | CPIC atomoxetine guideline 2019 (Brown et al.). https://pmc.ncbi.nlm.nih.gov/articles/PMC6612570/ | "consider obtaining a plasma concentration 4 h after dosing" | Source-matched | 2026-10-24 |
| Atomoxetine, adult (40 mg/day) poor-metabolizer recommendation and its strength (Moderate), word for word as in fixture P14 | CPIC atomoxetine guideline 2019 (Brown et al.), original PDF, the fixed-dose table's poor-metabolizer row. https://files.cpicpgx.org/data/guideline/publication/atomoxetine/2019/30801677.pdf (also the CPIC API, population "adults") | "consider obtaining a plasma concentration 2–4 hours after dosing" | Source-matched (Claude, from the PDF text; the table title naming the population was not captured by the extraction) | 2026-10-24 |
| Atomoxetine, ultrarapid: caution because standard dosing may not reach adequate concentrations (alert level YELLOW) | Same CPIC atomoxetine guideline, ultrarapid row implication, and the CPIC API | "unlikely ultrarapid metabolizers would achieve adequate serum concentrations" | Source-matched | 2026-10-24 |
| Atomoxetine at activity score 1.0 depends on the `*10` allele (requirement R44). With `*10` present: titration row (YELLOW). Without: standard 1.0 row (GREEN). | Same CPIC atomoxetine guideline, original PDF, adult-dose table, two separate rows. https://files.cpicpgx.org/data/guideline/publication/atomoxetine/2019/30801677.pdf. The CPIC API returns only the "not present" row. | rows "1.0 (*10 allele present)" and "1.0 (*10 allele not present)"; footnote: "allele-dependent, based on the presence of the CYP2D6*10 allele" | Source-matched (Claude, from the PDF text; the API does not have the "present" row) | 2026-10-24 |
| Atomoxetine phenoconversion is described by CPIC for strong CYP2D6 inhibitors only; CPIC 2019 says nothing about moderate or weak inhibitors, and neither does the FDA STRATTERA label. So RxGene shows "Not assessed" for a moderate inhibitor and does NOT claim that CPIC states no adjustment. | CPIC atomoxetine guideline 2019, narrative on phenoconversion (original PDF); FDA STRATTERA label text searched for "moderate CYP2D6" (0 hits). https://files.cpicpgx.org/data/guideline/publication/atomoxetine/2019/30801677.pdf | "Individuals taking atomoxetine along with a strong CYP2D6 inhibitor" | Source-matched (Claude searched the full PDF and label text); the CPIC supplementary material was NOT opened | 2026-10-24 |
| Fluoxetine inhibition can persist after the drug is stopped (not modeled; steady-state limitation, R43) | Same CPIC atomoxetine 2019 narrative | "up to 2–3 months after fluoxetine discontinuation" | Source-matched | 2026-10-24 |
| Clopidogrel, CYP2C19 poor metabolizer (ACS/PCI): avoid clopidogrel, use prasugrel or ticagrelor (RED, Strong). Intermediate: avoid standard-dose clopidogrel, same alternatives. | CPIC clopidogrel guideline 2022 update (Lee et al.), original PDF. https://files.cpicpgx.org/data/guideline/publication/clopidogrel/2022/35034351.pdf (also the CPIC API, population "CVI ACS PCI") | "Avoid clopidogrel if possible." | Source-matched (Claude, from the PDF text) | 2026-10-24 |
| Omeprazole with clopidogrel: avoid concomitant use (a label-level note, not a computed phenoconversion) | FDA PLAVIX label, warnings 5.1 and interactions 7.1 (DailyMed set id de8b0b67-eb25-4684-83b5-7ad785314227, version 5, published 2025-06-11) | "Avoid concomitant use of omeprazole or esomeprazole." | Source-matched (Claude, from the label XML) | 2026-10-24 |
| About 99.5% of 487,409 UK Biobank participants "may have an atypical response to at least one drug" (predicted from 14 CPIC pharmacogenes); nearly 24% of participants had been prescribed a drug for which they are predicted to have an atypical response. Both are predictions from genotypes, not measured adverse-event rates. | McInnes et al., "Pharmacogenetics at Scale: An Analysis of the UK Biobank", *Clin Pharmacol Ther* 2021;109(6), DOI 10.1002/cpt.2122. https://pmc.ncbi.nlm.nih.gov/articles/PMC8144239/ | "99.5% of individuals may have an atypical response to at least one drug" | Source-matched (Claude, abstract and text) | 2026-10-24 |
| The current XELODA (capecitabine) FDA label carries a boxed warning on DPD deficiency and tells prescribers to test for DPYD variants before starting, unless immediate treatment is necessary. The label (DailyMed set id e702d84d-7162-4751-bf37-d724cc7e45a5, version 32, published 2026-02-06) shows patient information revised 10/2025. This is stronger than "consider testing". The 5-FU (fluorouracil) label was NOT opened. | FDA XELODA label, boxed warning and section 5.1. https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e702d84d-7162-4751-bf37-d724cc7e45a5 | "Test patients for genetic variants of DPYD prior to initiating XELODA" | Source-matched (Claude, from the label XML) | 2026-10-24 |
| Kiro describes using deterministic checks alongside AI generation (a verifiable alternative to the unverified quote below) | Kiro IDE page. https://kiro.dev/ide/ | "uses deterministic tools such as property-based tests to verify that code is correct" | Source-matched (Claude, from the page text) | 2026-10-24 |
| Allele activity values for the demo patients: `*1` 1.0, `*2` 1.0, `*4` 0.0, `*5` 0.0, `*9` 0.25, `*10` 0.25, `*17` 0.5, `*41` 0.25 | CPIC API allele table. https://api.cpicpgx.org/v1/allele?genesymbol=eq.CYP2D6 | e.g. `"name":"*10","activityvalue":"0.25"` | Source-matched | 2026-10-24 |
| About 20–30% of people in settings where CYP2D6 genotype might be used also take a phenoconverting inhibitor (a reported figure, not a measured cohort rate) | Cicali et al., *Clin Pharmacol Ther* 2021;110(3):677-687. https://pmc.ncbi.nlm.nih.gov/articles/PMC8404400/ | "approximately 20–30% of individuals are also taking an enzyme inhibitor" | Source-matched | 2026-10-24 |
| Five of the ten FDA-classified strong or moderate CYP2D6 inhibitors are on the 2021 Top 300 Drugs list | Same paper | "five of the ten CYP2D6 inhibitors classified by the FDA as strong" | Source-matched | 2026-10-24 |
| Borges et al. 2010 defined two CYP2D6 inhibitor factors for a composite activity score (the paper behind the method; it does not by itself show our 0 and 0.5 factors) | Borges et al., *J Clin Pharmacol* 2010;50(4):450-458. https://pmc.ncbi.nlm.nih.gov/articles/PMC3816977/ | "Two inhibitor factors were defined: one genotype-independent and one genotype-based." | Source-matched | 2026-10-24 |

## Wording to use

- Say: "We apply CPIC's stated phenoconversion convention from the 2021 opioid guideline,
  to codeine and tramadol." Do not say: "CPIC recommends X for this phenoconverted patient."
- For atomoxetine with a strong inhibitor, say: "The FDA label treats a strong CYP2D6
  inhibitor like a poor metabolizer for titration." Do not call it a computed
  phenoconversion.
- The 20–30% figure is a secondary citation: Cicali et al. report it from earlier studies.
  Say "reported in", and use "approximately".
- The SSRI/SNRI ultrarapid statement is limited to paroxetine. Do not generalize it.
- Cite the CPIC opioid guideline for the 0 and 0.5 factors, not Borges (see below).
- `*10` is 0.25 in the current CPIC table. The 2019 supplement used older values.

## Unverified: not opened in the source itself

| Claim | Why it is unverified |
|---|---|
| The exact 0 and 0.5 factors in Borges et al. 2010 | Seen only through Cicali's description of Borges, not in Borges itself. |
| CPIC thresholds as standardized by Caudle et al. 2020 | Not opened. We cite the 2021 opioid guideline's Table 1 instead. |
| Supplementary Material S1 of the SSRI/SNRI guideline | Not opened. |
| The 5-FU (fluorouracil) label update for DPD deficiency | Not opened. Only the capecitabine (XELODA) label was checked. DPYD is not built today, so it only appears as "what's next". |
| The Kiro team post of 2026-10-22 and its wording "AI proposes, deterministic code decides" | Searched the Kiro blog index and the web: not found. UNVERIFIED: do not quote it, and it is excluded from the pitch. Use the Kiro IDE page line above instead. |
| Fixtures P01–P25 matching all of the above | All 25 approved by Ananya at the expected-output level. This is not independent verification of every source and not clinical validation. |

## Known discrepancies to be ready for

1. **Atomoxetine titration interval.** The FDA label says a strong CYP2D6 inhibitor or a poor
   metabolizer should have a 4-week titration interval. The CPIC 2019 poor-metabolizer text
   in our data says to review after 2 weeks. **Decision (Ananya, after review):** the P13
   card leads with the FDA label, shows the CPIC text only as supporting genotype-based
   context, and states that the two are different guidance contexts, not interchangeable
   (requirement R17).
2. **Atomoxetine at activity score 1.0 (resolved, R44).** CPIC's table footnote says the
   recommendation is allele-dependent, based on the `*10` allele, and the PDF has two rows.
   The API returns only the "not present" row. Decision (Ananya): follow CPIC. A `*10`
   allele at exactly 1.0 uses the titration row (YELLOW); otherwise the standard row. CPIC
   still marks the whole 1.0 area "controversy remains".
3. **Activity score 1.0 label.** The 2019 atomoxetine paper treats it as a normal or
   intermediate metabolizer depending on context; the 2021 opioid table puts it in the
   intermediate range (0 < x < 1.25). The app uses the 2021 label, and uses the
   standard-titration atomoxetine row at 1.0, as `clinical-rules.md` says.
4. **CYP2C19 phenoconversion is not modeled**, although the FDA table lists fluoxetine as a
   strong CYP2C19 inhibitor. See the README limitations.

## Remaining limitations and verification status (2026-10-24)

**What a person verified vs what an agent verified**
- **Human-verified (Ananya):** six FDA inhibitor rows only: fluoxetine, paroxetine, bupropion
  (strong), duloxetine (moderate), sertraline (weak), omeprazole (CYP2C19 weak).
- **Reviewed by Ananya at the expected-output level:** all 25 fixtures (P01 to P25).
- **Source-matched only (an agent or Claude string-matched the source; no human check):**
  every other quote in this file, the CPIC allele values, and all recommendation texts.
- **`data/alert_levels.json`:** 15 of 41 entries are covered by an approved fixture. The other
  26 are listed in `_reviewed_entries` in that file. All 26 previously unvalidated alert-level
  entries were reviewed by Ananya for consistency with the documented CPIC recommendations and
  approved RxGene fixtures. Their alert levels were retained unchanged. This review does not
  constitute independent verification of every primary source or clinical validation of the
  application.
  - GREEN means no supported PGx alert, not overall medication safety.
  - Atomoxetine Normal and Ultrarapid rows may have identical dosing text but different alert
    levels because their CPIC clinical implications differ.
  - The CYP2C19 Likely Poor and Likely Intermediate entries remain in the mapping even if the
    current engine cannot produce those phenotypes.

**Not opened or not checked**
- CPIC supplementary material (the antidepressant guideline's S1 and the atomoxetine
  supplement); Caudle et al. 2020.
- The exact 0 and 0.5 factors in Borges et al. 2010 (seen only through Cicali et al.).
- The table title naming the population "adults" in the CPIC atomoxetine PDF (population taken
  from the CPIC API field).
- The 5-FU (fluorouracil) label, and the Kiro team post of 2026-10-22 with its wording "AI
  proposes, deterministic code decides" (not found; do not quote it).

**Clinical limitations of the model**
- Steady state only: no inhibitor onset or washout. Fluoxetine inhibition may last 2 to 3
  months after it is stopped (CPIC atomoxetine 2019), so a recently stopped fluoxetine is not flagged.
- CYP2C19 phenoconversion is not modeled, although the FDA table lists fluoxetine as a strong
  CYP2C19 inhibitor. Omeprazole with clopidogrel appears only as a label note.
- The x0 and x0.5 rule is applied to codeine and tramadol only (CPIC opioids 2021). Atomoxetine
  with a strong inhibitor follows the FDA label; with a moderate inhibitor it is "Not assessed"
  because neither CPIC 2019 nor the label addresses moderate inhibitors in the sections checked.
- If several inhibitors are listed, only the strongest is applied (a project design choice).
- Atomoxetine at activity score 1.0 is marked "controversy remains" by CPIC. The `*10` rule (R44)
  follows the PDF, not the API.
- Atomoxetine ultrarapid is YELLOW from CPIC's implication text; no fixture covers it.
- Synthetic data only. Not a medical device. "No supported PGx alert" does not mean safe.

## Pitch lines this supports

- "Roughly 1 in 4 people in genotyping settings also take an inhibitor that changes how
  their genes behave." Supported by Cicali et al., as a reported figure.
- "The CPIC 2023 antidepressant guideline says there is no agreed method. Only the 2021
  opioid guideline states the rule, so that is all we compute." Supported.
- "In a UK Biobank analysis of 487,409 people, 99.5% may have an atypical response to at
  least one drug, based on 14 CPIC genes." Supported by McInnes et al. 2021. Say "may have" and
  "predicted": it is a prediction from genotypes, not a measured outcome. (The pitch script does
  not use it.)
- "The FDA's capecitabine label now carries a boxed warning to test for DPYD variants before
  treatment." Supported for capecitabine only (label revised 10/2025), not for 5-FU. Use it for
  the "what's next" slide.
