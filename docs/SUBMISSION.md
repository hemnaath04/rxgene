# RxGene: submission text

**Track:** Healthcare & Biotech · **Challenge:** H4, Accelerating biotechnology innovation ("Discovery is slow, expensive, and hard to translate")
**Live demo:** https://rxgene.vercel.app · **Repo:** https://github.com/hemnaath04/rxgene · **How we used Kiro:** [KIRO.md](../KIRO.md)

## One line

**Your genes don't change. Your prescriptions do.** RxGene re-checks a patient's
pharmacogenomic (PGx) results every time a medication is added, including when another drug
makes a genetically "normal" patient process medicines like a poor metabolizer.

## The problem

Your liver has a cleanup crew for medicines, the enzyme CYP2D6. Your DNA says how fast that
crew works. Some common drugs jam it.

So a patient whose genetic report says "normal" can, while taking fluoxetine (an
antidepressant), clear codeine like someone with no working enzyme. Codeine then won't relieve
their pain. This is called **phenoconversion**.

- In settings where CYP2D6 genotype is used, roughly 20–30% of patients also take an inhibitor that causes it (Cicali et al., *Clin Pharmacol Ther* 2021).
- The genetic report alone is falsely reassuring.
- A typical drug-interaction checker gives the same generic warning to every patient, whatever their genes.

## What RxGene does

- **Re-checks the whole medication list** whenever a drug is added. Adding fluoxetine re-alerts the codeine the patient already takes.
- **A deterministic rule engine** decides every alert:
  - the CYP2D6 activity score, from CPIC allele data
  - a strong inhibitor sets the score to 0 and a moderate one halves it (the CPIC opioid guideline, 2021)
  - the score maps to a phenotype, which looks up the CPIC recommendation
  - CYP2C19 and clopidogrel are also covered
- **One precise alert instead of two blunt ones.** A patient who is already a poor metabolizer still gets the codeine warning, and the note says the inhibitor adds nothing further.
- **Honest states.** "No supported alert (not the same as safe)", "Not assessed" and "Insufficient data" are kept distinct. A reduced-confidence flag marks cases where the guideline is uncertain (an ultrarapid metabolizer on a strong inhibitor).
- **Plugs into an EHR.** It's a real CDS Hooks service (`order-select`) that reads standard FHIR genomics Observations. We tested it in the public CDS Hooks sandbox.
- **An evidence drawer for every alert.** It shows both phenotypes, the activity score before and after, the guideline, the evidence strength and source date, and the requirement IDs that produced the alert.
- **A plain-language summary for the patient** in English and Spanish. An LLM rewrites the engine's result and is validated (same drug, same action, every dose kept, no new drugs or numbers, never "safe"); if validation fails, a fixed template is shown.
- **A pharmacist consult agent** **[TO FILL when shipped]**. It calls the rule engine as a tool for every medication and drafts the consult note a pharmacist would file. Every sentence cites a tool result, and it's always labeled "Draft — pharmacist review required."
- **Real-world context from openFDA** **[TO FILL when shipped]**. The panel shows FAERS report counts for the patient's drug pair, with the caveat that a report is not proof of cause.

## Who it's for and how it scales

- **First users:** health-system pharmacists who already hold PGx results. Today they handle phenoconversion by hand in consult notes.
- **Prescribers** see the alert inside the EHR through CDS Hooks.
- **Patients** get a plain-language summary, including in Spanish.
- **Scale:** the engine is data-driven, so adding a gene or drug means adding CPIC data and requirements, not rewriting logic. Next on the list are DPYD (capecitabine and 5-FU, which now have updated FDA labeling) and PDF lab-report intake.

## Safety by design

- **AI proposes, deterministic code decides.** No AI output can create, change or suppress an alert.
- 56 numbered EARS requirements, written by our genetics teammate before the code and checked by Kiro's requirements analysis.
- 25 hand-reviewed expected-output test patients.
- Synthetic data only. This is not a medical device. Phenoconversion is computed only where CPIC states the rule, and limitations are documented in the README.

## Data sources

- CPIC guidelines and the CPIC API (allele functions and recommendations)
- The FDA table of CYP2D6 inhibitors
- openFDA FAERS (real-world reports)
- HL7 FHIR Genomics Reporting and CDS Hooks
