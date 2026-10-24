# Structure

```
web/src/engine/     activityScore.ts, phenotype.ts, phenoconversion.ts, recommend.ts (pure, tested)
web/src/components/ OrderScreen, AlertCard, EvidenceDrawer, ReportView, ConfirmExtraction
web/src/data/       imports JSON from ../../data (or copies it at build time)
server/             POST /extract (report text -> candidate genotypes), POST /explain
data/               CPIC snapshots + inhibitors.json + synthetic reports
tests/fixtures/     expected outputs for the 21 test patients
scripts/            data snapshot + fixture generation (Python)
docs/               plan, verified answers, sources
```

- Engine functions take plain objects and return plain objects. No React inside the engine.
- Every alert object carries `source`, `guideline`, `strength` and `fetched` for the evidence drawer.
- Name things after the clinical concept: `activityScore`, `adjustedPhenotype`, not `score2`.
