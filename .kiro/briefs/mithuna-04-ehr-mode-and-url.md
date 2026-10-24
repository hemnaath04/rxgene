Model: auto. Read .plans/rxgene-architecture-spec.md sections 1 and 3, and .kiro/steering/structure.md.

Task: make the UI default to EHR mode, with local fallback and URL state.

1. web/src/lib/cdsClient.ts: buildRequest(patient, meds, addedDrug) returns an order-select request. It includes a hookInstance UUID (crypto.randomUUID); context with userId "Practitioner/demo", patientId and selections; draftOrders as a Bundle of MedicationRequest (one per med plus the added drug, each with medicationCodeableConcept.text = the drug name); and prefetch.patient plus prefetch.pgx (built with buildPgxObservation from web/api/_lib/fhir.ts). Also add send(request), which POSTs to /cds-services/rxgene-order-select with a 3 s AbortController timeout.
2. web/src/lib/url.ts: read and write ?patient=&meds=&add=&mode=&lang= with history.replaceState. Medications are comma-separated. Defaults: mode=ehr, lang=en.
3. ModeToggle (shadcn Switch) labeled "EHR mode (CDS Hooks)" / "Local". In EHR mode, render the returned cards. On an error or timeout, run checkOrder locally and mark every card "local fallback". Each card shows a small badge: "via CDS Hooks" or "local fallback" or "local".
4. In EHR mode, an expandable "Request / Response" panel shows the JSON sent and received, and the latency in ms.
5. Opening /?patient=sarah&add=codeine must land directly on the case 1 alert.

The engine still decides everything; the UI only renders the assessments or cards. Don't run git. List the files you changed.
