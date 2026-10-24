// GET /cds-services: CDS Hooks discovery (architecture spec section 4).

export const PREFETCH = {
  patient: 'Patient/{{context.patientId}}',
  pgx: 'Observation?patient={{context.patientId}}&code=http://loinc.org|84413-4',
  medications: 'MedicationRequest?patient={{context.patientId}}&status=active'
} as const;

export const DISCOVERY = {
  services: [
    {
      id: 'rxgene-order-select',
      hook: 'order-select',
      title: 'RxGene pharmacogenomics check',
      description:
        "Re-checks the patient's CYP2D6/CYP2C19 genotype against CPIC guidelines and the current " +
        'medication list (including CYP2D6 inhibitor phenoconversion) when a medication is selected.',
      prefetch: PREFETCH
    }
  ]
};

export async function GET(): Promise<Response> {
  return Response.json(DISCOVERY);
}

// CORS headers come from vercel.json (prod) and the devApi plugin (dev).
export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204 });
}
