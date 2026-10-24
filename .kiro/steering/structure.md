# Structure (full detail: .plans/rxgene-architecture-spec.md section 2)

```
web/api/                 cds-services.ts, cds-services/rxgene-order-select.ts, summary.ts, _lib/{fhir,llm}.ts
web/src/engine/          activityScore, phenotype, phenoconversion, recommend, cdsCard, templates (+ tests)
web/src/components/      PatientPicker, MedList, AlertCard, Gauge, EvidenceDrawer, ComparisonStrip, PatientSummary, ModeToggle
web/src/components/ui/   shadcn generated; don't hand-edit unless restyling
web/src/lib/             cdsClient.ts (builds CDS Hooks requests), url.ts (URL state)
web/src/data/            generated copy of ../data, plus patients.ts (tracked)
data/                    source-of-truth CPIC snapshots + inhibitors.json
tests/fixtures/          22 expected outputs
```

- Engine functions take plain objects and return plain objects.
- Every alert carries `source`, `guideline`, `strength` and `fetched`.
- Name things after the clinical concept: `activityScore`, `adjustedPhenotype`.
- All app state lives in URL params (`?patient=&meds=&add=&mode=&lang=`).
