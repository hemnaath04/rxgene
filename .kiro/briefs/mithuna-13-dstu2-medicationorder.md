Model: claude-haiku-4.5. Small; run between brief 11 and brief 12.

Found by registering https://rxgene.vercel.app/cds-services in the public CDS Hooks sandbox (sandbox.cds-hooks.org, Rx View). The sandbox's FHIR server is DSTU2 (`fhirServer: https://launch.smarthealthit.org/v/r2/fhir`), so it sends:
- `context.selections: ["MedicationOrder/order-123"]`
- `context.draftOrders.entry[].resource.resourceType: "MedicationOrder"`, with `medicationCodeableConcept.text: "Codeine sulfate 30 MG Oral Tablet"` (RxNorm 997287)

Our service returned `{"cards": []}`, because web/api/_lib/fhir.ts only accepts R4 `MedicationRequest`.

Fix in web/api/_lib/fhir.ts (server-path rules: .js extensions, no '@/'):
1. medsFromRequest accepts both `MedicationRequest` (R4) and `MedicationOrder` (DSTU2) in draftOrders and in prefetch.medications. Treat MedicationOrder status "active" or "draft" like MedicationRequest.
2. Match context.selections against `${resourceType}/${id}` for either type, and also match on bare ids.
3. Keep the drug-name matching as it is ("Codeine sulfate 30 MG Oral Tablet" → codeine already works).
4. When a sandbox patient has no genotype Observation, the service must return ONE info card with the Insufficient-data text. That's the correct, honest answer, and it shows the round trip works.

Test (web/api/cds-services.test.ts): post the DSTU2 request above with no pgx prefetch and no fhirServer reachable (mock fetch to return an empty Bundle). Expect exactly 1 card, indicator "info", and the Insufficient-data text. Keep every existing test passing.

Run `npx tsc -b`, `npm test` and `npm run build`. Don't run git. List the files you changed.
