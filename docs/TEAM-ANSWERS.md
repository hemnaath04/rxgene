# Answers to Mithu's 10 questions (checked against primary sources, Oct 24)

**Ananya's answers were mostly right. Fix four things before pitching:**
1. Only the **2021 opioid guideline** states the phenoconversion rule. The 2023
   antidepressant guideline says the opposite.
2. CYP2D6 **\*41 and \*9 are 0.25**, not 0.5.
3. Don't make specific claims about what interaction checkers say. I couldn't verify one.
4. Cut the expanded Layer 1 (warfarin, simvastatin).

---

**1. Does CPIC give a phenoconversion rule?** Yes, but only in one guideline.
- **CPIC opioids 2021 (Crews et al., PMC8249478)**, section "Modification of the predicted
  phenotype by drug-drug interactions," says:
  > "For patients on strong CYP2D6 inhibitors, the CYP2D6 activity score is adjusted to 0
  > and the predicted phenotype is a poor metabolizer. For patients who are on moderate
  > CYP2D6 inhibitors, the activity score is multiplied by 0.5 and then converted to the
  > predicted phenotype."
- **CPIC antidepressants 2023 (Bousman et al.)** main text says the opposite:
  > "Consensus approaches for adjusting CYP2D6, CYP2C19, or CYP2B6 predicted phenotypes in
  > the presence of inhibitors or inducers have not been established."

  So Ananya's "same convention in the antidepressant supplement" is wrong.
- **CPIC atomoxetine 2019** describes fluoxetine/paroxetine phenoconversion only in prose,
  with no conversion rule. It notes the effect of fluoxetine "may last up to 2–3 months
  after fluoxetine discontinuation."
- **Method paper:** Cicali et al., "How to Integrate CYP2D6 Phenoconversion into Clinical
  Pharmacogenetics: A Tutorial," *Clin Pharmacol Ther* 2021, doi 10.1002/cpt.2354
  (PMC8404400). UF Health and Mayo Clinic use this method in practice.
- **What to build:** compute phenoconversion for **codeine and tramadol only**. For
  atomoxetine, handle a strong inhibitor using the FDA label wording ("dose as for a poor
  metabolizer"). For a moderate inhibitor with atomoxetine, **don't compute anything**:
  show "pharmacist review."
- **What to say:** "We apply the rule CPIC states in its opioid guideline." Don't say
  "CPIC recommends X for phenoconverted patients" in general.

**2. A case where combining gene + drug gives a different answer.** Use **two patients side
by side**. One case alone doesn't hold up well against an interaction checker, which will
also flag fluoxetine + codeine.

| | Patient A: CYP2D6 \*1/\*1 + fluoxetine → codeine | Patient B: CYP2D6 \*4/\*4 + fluoxetine → codeine |
|---|---|---|
| Genotype report alone | Normal (activity score 2.0), **green**. Falsely reassuring. | Poor metabolizer, avoid |
| Interaction checker alone | Flags fluoxetine–codeine | **The same flag**. It can't tell A from B. |
| Ours | Activity score 2.0 → **0 (poor metabolizer)**. Avoid codeine; consider a non-tramadol opioid (CPIC, strong). | Poor metabolizer by genotype. **The inhibitor adds no further effect**, so there's one alert instead of two (less alert fatigue). |

- **Third case if a judge pushes:** \*1/\*41 + duloxetine (a moderate inhibitor). The
  genotype gives an activity score of 1.25 (normal, green). Halved, it's 0.625, which makes
  the patient an **intermediate metabolizer**: "use label dosing, consider an alternative if
  there's no response."
- I could not verify Drugs.com's or Lexicomp's severity rating. **Don't claim** that
  checkers say "moderate" or "no action."

**3. Codeine or atomoxetine for the demo?** **Codeine first.** Its CPIC recommendation is
"Strong," and the rule is stated in the guideline itself. Keep atomoxetine as the second
case to show the other direction: the drug builds up. Correction: codeine's FDA boxed
warning is about **ultrarapid** metabolizers (child deaths). It isn't about the
poor-metabolizer case, so don't cite it for "the painkiller stops working."

**4. Add clopidogrel + omeprazole?** Keep clopidogrel as a **genotype-only** case. Show
omeprazole as a **separate label-level interaction note**, not as a computed phenotype
change. CPIC 2023 says there's no consensus method for CYP2C19 either. Note that CPIC's
clopidogrel recommendations depend on the indication, so use the **ACS/PCI** population
throughout.

**5. DPYD?** Drop it from the code and keep it on one slide. Agreed with Ananya.

**6. CYP2D6 activity-score thresholds** (the current CPIC standard, as printed in CPIC
2023):
- 0 = poor metabolizer
- above 0 and below 1.25 = intermediate
- 1.25 to 2.25 = normal
- above 2.25 = ultrarapid

The 2019 atomoxetine guideline used older bands and called an activity score of 1.0
"normal or intermediate (controversy remains)." **The fix:** look up atomoxetine
recommendations by **activity score**, not by phenotype label, because CPIC's database
keys them that way. At an activity score of 1.0, the recommendation is the same as for a
normal metabolizer.

⚠️ **Don't type allele values from memory.** In the CPIC API today:
- \*1 and \*2 = 1.0
- \*9, \*10 and \*41 = **0.25**
- \*17 and \*29 = 0.5
- \*3, \*4, \*5 and \*6 = 0

Pull them from `api.cpicpgx.org/v1/allele?genesymbol=eq.CYP2D6`.

**7. A source for the pitch.** Use Cicali 2021 (verified wording):
> "approximately 20–30% of individuals are also taking an enzyme inhibitor that leads to
> phenoconversion… a majority of clinicians have limited knowledge of the drugs that might
> cause phenoconversion… and no tool exists to facilitate integration."

Caveat: that was written in 2021. Commercial tools such as YouScript now advertise
phenoconversion checks, so say "no open, guideline-cited tool," not "no tool exists."

**8. Who uses it, and which Massachusetts hospitals have PGx programs?** The **pharmacist**
uses it. PGx consult services are typically pharmacist-led, and the alert fires when the
doctor prescribes. Massachusetts examples:
- **Brigham and Women's Hospital Pharmacogenomics Clinic**, co-founded by Roseann Gammal,
  PharmD, MCPHS (https://www.mcphs.edu/directory/0111184)
- **Boston Children's Hospital Clinical Pharmacogenomics Service**

Say "programs like…". Never imply a partnership.

**9. Expected outputs for the test patients.** Done: **21 patients** in
`tests/fixtures/expected_outputs.csv` and `.json`. Every recommendation is pulled word for
word from the CPIC API. Ananya should still review them by eye.

**10. Presenting the science part?** That's the team's call, not mine. My suggestion:
Ananya presents the science. It's the strongest proof that this is real science and not a
generic chatbot.

---

## About "how do we build more" (Ananya's layers)

**Cut from Layer 1:**
- **Warfarin** needs a full dosing algorithm.
- **Simvastatin–SLCO1B1** is a different gene with no phenoconversion.
- **Color-coding alone** is the plain lookup tool that already exists.

**Layer 1 should be:** the CYP2D6 activity-score engine plus phenoconversion, covering
codeine, tramadol and atomoxetine, plus clopidogrel genotype-only. Add the four honest
states: red, yellow, green, grey (not assessed).

**Keep from Layer 2:**
- A messy-report reader **with a confirmation step**
- Clinician and patient explanations
- The "what if I prescribe X" check. That is your demo, so treat it as core, not a stretch.

**Skip:** Spanish, PDF export, and chat. Add them only if everything else is done by 5 PM.
