# Product: RxGene

A pre-prescription pharmacogenomics check. When a clinician adds a medication, RxGene
re-checks the patient's existing PGx results against CPIC guidelines **and** the current
medication list. It catches phenoconversion, where an inhibitor drug makes a genetically
normal metabolizer behave like a poor one.

- **Users:** clinical pharmacists first (they run PGx consult services); prescribers see the alert.
- **Pitch line:** "Your genes don't change. Your prescriptions do."
- **Design rule:** AI proposes, deterministic code decides. The LLM extracts data from
  messy reports (a human confirms it) and writes explanations. It never chooses a recommendation.
- **Not:** a therapy recommender, a diagnosis tool, or a replacement for a pharmacist.
- **Data:** synthetic patients only.
