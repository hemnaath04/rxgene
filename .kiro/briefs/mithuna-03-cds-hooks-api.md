Model: claude-sonnet-4.5. Read .plans/rxgene-architecture-spec.md sections 1-4 and 9, .plans/rxgene-build-spec.md section 5, .kiro/specs/rxgene-engine/requirements.md, and the engine in web/src/engine/.

Task: build the real CDS Hooks service and make it run in local dev. Don't change the engine's logic or the fixtures.

1. web/api/_lib/fhir.ts:
   - parseGenotype(bundle, gene): find an Observation with code LOINC 84413-4 whose component (code LOINC 48018-6) has HGNC:2625 (CYP2D6) or HGNC:2621 (CYP2C19). Read the diplotype from valueCodeableConcept.text, valueString or coding[0].display. Strip a "CYP2D6"/"CYP2C19" prefix and suballele suffixes (*1.001 -> *1). Return null if not found or unparsable.
   - medsFromRequest(context, prefetch): ingredient names from every draftOrders MedicationRequest plus active prefetch.medications entries, matched case-insensitively against the known drugs (the keys in web/src/data/cpic/recommendations plus every drug in web/src/data/inhibitors.json). Also return which one is selected (context.selections).
   - buildPgxObservation(patientId, gene, diplotype): the inverse, used by the client and tests.
2. web/api/cds-services.ts: export GET returning discovery with one service: id "rxgene-order-select", hook "order-select", title, description, and the prefetch templates patient, pgx and medications from architecture spec section 4.
3. web/api/cds-services/rxgene-order-select.ts: export POST (and OPTIONS). Parse the request, then get the genotype from prefetch.pgx. If it's missing and fhirServer is given, GET {fhirServer}/Observation?patient=...&code=http://loinc.org|84413-4 with a 3 s timeout (send the fhirAuthorization bearer token if present). Build the Patient, call checkOrder(patient, addedDrug), and return { cards: assessments.map(toCdsCard) }. An invalid body returns 400 with a JSON error.
4. web/vercel.json: rewrite /cds-services and /cds-services/:path* to /api/cds-services and /api/cds-services/:path*. CORS headers on both paths: Access-Control-Allow-Origin *, methods GET,POST,OPTIONS, headers Content-Type,Authorization.
5. Dev API: a Vite plugin in web/vite-plugins/devApi.ts, registered in vite.config.ts. It maps /api/** and /cds-services/** to the handlers in web/api/ (load them with server.ssrLoadModule), converts Node req/res to a Web Request/Response, and applies the same CORS headers and rewrites as vercel.json.
6. Tests in web/api/*.test.ts:
   - discovery returns exactly one service
   - an order-select request shaped like fixture P01 (CYP2D6 *1/*1 Observation in prefetch.pgx, fluoxetine + codeine draftOrders, codeine selected) returns a "critical" card whose summary is under 140 characters
   - with no pgx Observation, the card says Insufficient data
   - a P02-shaped request (*4/*4) returns critical plus the "adds no further effect" note

Don't run git. When you finish, list the files you created.
