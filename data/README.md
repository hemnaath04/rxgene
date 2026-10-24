# Data

Everything the rule engine reads. No patient data here is real.

| Path | What | How it's made |
|---|---|---|
| `cpic/*_alleles.json` | CYP2D6 activity values and CYP2C19 function per allele | `python3 scripts/fetch_cpic.py` |
| `cpic/recommendations/*.json` | CPIC recommendation text per drug, by phenotype or activity score | same script |
| `cpic/guidelines.json` | Guideline names and URLs for citations | same script |
| `inhibitors.json` | CYP2D6 inhibitor strength (strong/moderate) | hand-curated; verify against FDA table |
| `synthetic-reports/` | Fake lab reports for the upload/extraction demo | hand-written |

Each snapshot file records its `source` query and `fetched` date. Show the date in the
evidence drawer.

**Never type allele values from memory.** For example, CYP2D6 `*9`, `*10` and `*41` are
0.25, not 0.5.
