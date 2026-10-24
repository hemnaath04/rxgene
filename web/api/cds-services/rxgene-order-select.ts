// POST /cds-services/rxgene-order-select: the CDS Hooks order-select service.
// Genotype source: prefetch.pgx, then a fhirServer fetch (3 s timeout), then
// "Insufficient data" (the engine reports a missing genotype as GREY).
import { checkOrder, toCdsCard } from '../../src/engine/index';
import type { Patient } from '../../src/engine/index';
import {
  LOINC_GENOTYPE,
  LOINC_SYSTEM,
  medsFromRequest,
  parseGenotype,
  patientName
} from '../_lib/fhir';
import type { Bundle, OrderSelectContext, Prefetch } from '../_lib/fhir';

const FHIR_TIMEOUT_MS = 3000;

type CdsRequest = {
  hook?: string;
  hookInstance?: string;
  fhirServer?: string;
  fhirAuthorization?: { access_token?: string; token_type?: string } | null;
  context: OrderSelectContext & { patientId: string };
  prefetch?: Prefetch | null;
};

const badRequest = (error: string) => Response.json({ error }, { status: 400 });

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Returns an error message, or null if the body is a usable order-select request. */
function validate(body: unknown): string | null {
  if (!isObject(body)) return 'Request body must be a JSON object';
  if (body.hook !== undefined && body.hook !== 'order-select') return `Unsupported hook: ${String(body.hook)}`;
  if (!isObject(body.context)) return 'Missing context';
  if (typeof body.context.patientId !== 'string' || body.context.patientId === '') {
    return 'Missing context.patientId';
  }
  if (body.context.selections !== undefined && !Array.isArray(body.context.selections)) {
    return 'context.selections must be an array';
  }
  if (body.prefetch !== undefined && body.prefetch !== null && !isObject(body.prefetch)) {
    return 'prefetch must be an object';
  }
  if (body.fhirServer !== undefined && typeof body.fhirServer !== 'string') {
    return 'fhirServer must be a string';
  }
  return null;
}

/** GET {fhirServer}/Observation?patient=..&code=loinc|84413-4. Any failure returns null. */
async function fetchPgxBundle(req: CdsRequest): Promise<Bundle | null> {
  let base: URL;
  try {
    base = new URL(req.fhirServer!);
  } catch {
    return null;
  }
  // Only plain http(s) FHIR servers; never file:, data:, etc.
  if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;

  const url = new URL(`${base.href.replace(/\/+$/, '')}/Observation`);
  url.searchParams.set('patient', req.context.patientId);
  url.searchParams.set('code', `${LOINC_SYSTEM}|${LOINC_GENOTYPE}`);

  const headers: Record<string, string> = { Accept: 'application/fhir+json' };
  const token = req.fhirAuthorization?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(FHIR_TIMEOUT_MS) });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return isObject(json) && json.resourceType === 'Bundle' ? (json as Bundle) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const error = validate(body);
  if (error) return badRequest(error);
  const req = body as CdsRequest;
  const prefetch = req.prefetch ?? {};

  const { meds, selected } = medsFromRequest(req.context, prefetch);
  // No selected order with a known ingredient: nothing to check.
  if (!selected) return Response.json({ cards: [] });

  let cyp2d6 = parseGenotype(prefetch.pgx, 'CYP2D6');
  let cyp2c19 = parseGenotype(prefetch.pgx, 'CYP2C19');
  if (!cyp2d6 && !cyp2c19 && req.fhirServer) {
    const bundle = await fetchPgxBundle(req);
    cyp2d6 = parseGenotype(bundle, 'CYP2D6');
    cyp2c19 = parseGenotype(bundle, 'CYP2C19');
  }

  const patient: Patient = {
    id: req.context.patientId,
    name: patientName(prefetch.patient) ?? req.context.patientId,
    cyp2d6: cyp2d6 ?? undefined,
    cyp2c19: cyp2c19 ?? undefined,
    // checkOrder adds the selected drug itself
    meds: meds.filter(m => m !== selected)
  };

  const assessments = checkOrder(patient, selected);
  return Response.json({ cards: assessments.map(toCdsCard) });
}

// CORS headers come from vercel.json (prod) and the devApi plugin (dev).
export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204 });
}
