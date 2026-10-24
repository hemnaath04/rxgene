# Finalist pitch: Sunday Oct 25, WHOOP headquarters

**Schedule** (event slides): brunch at 11:00, opening remarks at 11:30, **finalist pitches
11:45 AM–1:15 PM**, then deliberation and awards from 1:30 to 2:00.

**Speakers:**
- **Hemnaath:** the problem, the live demo, the close
- **Ananya:** the science
- **Mithuna:** how we built it with Kiro

**Bring:** a laptop with https://rxgene.vercel.app open and the demo links in tabs, a charger,
and the backup video file offline in case the Wi-Fi is bad.

**Rules for everyone:**
- No brand drug names; say "fluoxetine, an antidepressant".
- Say "may have", not "have", for the UK Biobank number.
- Never compare openFDA numbers between drug pairs.

## The 3-minute script

### 0:00–0:25 · Hemnaath: the problem
> "Sarah's DNA test says she processes painkillers normally. She also takes fluoxetine, an
> antidepressant. Her doctor adds codeine. Her genetic report says fine. Her interaction
> checker gives a generic warning. But codeine likely won't relieve her pain, because
> fluoxetine has jammed the liver enzyme that activates it. Her genes say *normal*; her body
> is now *slow*. That's called phenoconversion, and it's what RxGene catches."

### 0:25–0:55 · Ananya: the science
> "The enzyme is CYP2D6. It handles many common medicines. A strong inhibitor, like
> fluoxetine, makes a normal metabolizer behave like a poor one. The CPIC opioid guideline
> states the rule: a strong inhibitor sets the activity score to zero.
> In settings where this gene is tested, a published review reports that roughly 20 to 30
> percent of people are also taking an inhibitor like this.
> Our rules come only from CPIC and the FDA, with sources, and the AI never decides an alert.
> Before any code was written, I wrote 56 numbered safety requirements."

*(Sources: CPIC opioids 2021; Cicali et al., Clin Pharmacol Ther 2021. The 20–30% is a
reported figure, not a measured cohort rate.)*

### 0:55–1:55 · Hemnaath: live demo
1. **Sarah** (`?patient=sarah&add=codeine`): the gauge slides from Normal to Slow, then
   "Avoid codeine." *"One click, and the guideline answer."*
2. **Inspect evidence:** both phenotypes, score 2.0 → 0, the guideline, the strength and the
   rule IDs. *"Every alert traces to a rule a pharmacist can read."*
3. **Review full medication list:** the agent's trace, then the cited note.
   *"An AI agent drafts the pharmacist's consult note. It calls our rule engine as a tool for
   every drug, and every sentence cites the tool result it came from. If a citation doesn't
   check out, the pharmacist gets the fixed template instead. It's always a draft."*
4. **Patient explanation → Español:** *"Plain language for the patient, in English or
   Spanish."*
5. If there's time, **Marcus** (`?patient=marcus&add=codeine`): *"Already slow by genes: one
   precise alert, not two."*

### 1:55–2:35 · Mithuna: how we built it with Kiro
> "The rule engine, the APIs and the consult agent were built with Kiro, spec first. Ananya's 56 requirements went
> into a Kiro spec. Kiro's requirements analysis found 42 issues, including a real clinical
> conflict we had missed. We fixed 27, and the rest are documented. Kiro generated 13
> property-based tests from those rules, and they found two real engine bugs our example cases
> missed. Both are fixed; all tests pass.
> And we used a Kiro hook so the coding agent physically can't edit the clinical data or
> expected answers it's tested against. We learned the hard way that our CLI version ignored
> the first version of that hook, and fixed it."

### 2:35–3:00 · Hemnaath: path to real use and close
> "RxGene is a real CDS Hooks service, the standard way decision support plugs into hospital
> records. A public test EHR already calls it. The first users are pharmacists, who handle this
> by hand today in consult notes. Next: more genes, like DPYD for chemotherapy, and reading
> PDF lab reports.
> Your genes don't change. Your prescriptions do. RxGene."

## The 30-second version (walk-up judges)

> "Sarah's DNA says she processes painkillers normally. But she takes fluoxetine, which jams
> the enzyme, so right now her body is slow and codeine won't work. Her genetic report says
> fine; her interaction checker is generic. RxGene combines both, re-checks every time a drug
> is added, and gives the guideline answer with the exact rule behind it. An AI agent drafts
> the pharmacist's note, but deterministic rules decide every alert. Built spec-first with
> Kiro. Your genes don't change. Your prescriptions do."

## Likely judge questions

**"Doesn't a drug-interaction checker already catch this?"**
It gives the same generic warning to every patient, whatever their genes. It can't tell a
normal metabolizer who's been converted from someone who was already a poor metabolizer. We
combine the gene result and the medication list, so we escalate when it matters, and give one
precise alert instead of two when it doesn't.

**"What if the AI is wrong?"**
The AI never decides an alert. Fixed, versioned rules from CPIC and the FDA decide. The agent
only drafts a note, and a validator rejects any uncited fact, any drug or number that's not in
the tool results, and the word "safe". If the note fails, the pharmacist sees the fixed
template. It's always labeled a draft.

**"Is this CPIC's recommendation for a phenoconverted patient?"**
We apply CPIC's stated phenoconversion rule (from the opioid guideline) to pick the matching
phenotype recommendation. We don't claim CPIC published a separate table for phenoconverted
patients.

**"Doesn't PharmCAT or another commercial PGx test already do this?"**
They interpret a genotype once. We re-check at every medication change and account for
drug-induced phenoconversion, plugged in where the prescription happens.

**"Isn't there already a phenoconversion calculator?"**
*(Name a specific product only if a teammate has verified it.)* Calculators are manual, one
gene and one drug at a time. RxGene takes the whole medication list, re-checks on every
change, emits an EHR-standard alert, and drafts the note and the patient summary.

**"What about an ultrarapid metabolizer on a strong inhibitor?"**
We apply the rule but flag *reduced confidence*, because CPIC notes ultrarapid metabolizers
may not phenoconvert to the same extent. The agent's note keeps that flag too.

**"What about timing: how long until the inhibitor takes effect, or wears off?"**
Out of scope today. The model is steady-state: a drug is on the list or it isn't. It's in our
limitations.

**"Is green 'safe'?"**
No. Green means "no supported alert, which is not the same as safe". We also separate "not
assessed" and "insufficient data".

**"What's the openFDA panel for?"**
It's informational context: real reports submitted to the FDA that list both medicines. A
report does not establish cause, and our rules never use these numbers. We don't compare them
between drug pairs.

**"How do you know your rules are right?"**
Our genetics teammate wrote 56 requirements with sources, and reviewed 26 expected-output test
patients by hand. Kiro's requirements analysis and 13 property-based tests then checked them.
The property tests found two real engine bugs, both now fixed.

**"Who pays? Who uses it?"**
Health systems and pharmacies that already hold PGx results. The pharmacy team is the first
user, because they handle phenoconversion by hand today. Prescribers see the alert inside the
EHR.

**"Is it a medical device?"**
No. It's a hackathon prototype on synthetic data. It's designed as clinician decision support
where the clinician can review the basis for every alert. That's design intent, not a
regulatory claim.

**"Limitations?"**
- Synthetic data only.
- A steady-state model.
- Phenoconversion is computed only where CPIC states the rule (codeine and tramadol).
- With several inhibitors, the strongest is applied, which is our design choice.
- CYP2C19 phenoconversion isn't modeled, and clopidogrel is modeled for ACS/PCI only.
