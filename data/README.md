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

## Licensing and attribution

- **CPIC data** (allele values, recommendations, guideline links) is released under
  [CC0 1.0](https://cpicpgx.org/?p=1245); this also covers the CPIC database and API.
  CPIC asks users to credit it as the primary source, cite the guideline publications,
  and note that guidelines change, so check cpicpgx.org for the latest version. **Don't use
  the CPIC logo or acronym as branding** (on slides, the UI or marketing) without NIH
  permission. Citing "CPIC opioids 2021" as a source is fine.
- **FDA inhibitor table:** U.S. government work, public domain. Source URL in `inhibitors.json`.
- **Patients and lab reports:** synthetic, written by the team. No real patient data anywhere.
- **Snapshot pinned 2026-10-24.** Don't re-run `fetch_cpic.py` during the event: a
  changed row would break the signed-off fixtures.
