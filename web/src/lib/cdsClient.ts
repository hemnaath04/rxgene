// Builds the CDS Hooks order-select request from app state and sends it to our own
// service (architecture spec section 3). The engine on the server decides; this file
// only packages the inputs and reads the cards back.
import { buildPgxObservation } from '../../api/_lib/fhir';
import type { Bundle, FhirResource, MedicationRequest, Observation } from '../../api/_lib/fhir';
import { GREEN_ALERT_TEXT } from '@/engine/cdsCard';
import type { Alert, CdsCard, Patient } from '@/engine/types';

export const ORDER_SELECT_PATH = '/cds-services/rxgene-order-select';
export const CDS_TIMEOUT_MS = 3000;
export const DEMO_USER_ID = 'Practitioner/demo';

export type OrderSelectRequest = {
  hook: 'order-select';
  hookInstance: string;
  context: {
    userId: string;
    patientId: string;
    selections: string[];
    draftOrders: Bundle;
  };
  prefetch: {
    patient: FhirResource;
    pgx: Bundle;
  };
};

export type CdsResponse = { cards: CdsCard[] };

/** The outcome of one call, kept for the Request / Response panel. */
export type CdsExchange =
  | { ok: true; status: number; response: CdsResponse; latencyMs: number }
  | { ok: false; error: string; status?: number; response?: unknown; latencyMs: number };

const bundle = (resources: FhirResource[]): Bundle => ({
  resourceType: 'Bundle',
  type: 'collection',
  entry: resources.map(resource => ({ resource }))
});

function medicationRequest(id: string, patientId: string, drug: string): MedicationRequest {
  return {
    resourceType: 'MedicationRequest',
    id,
    status: 'draft',
    intent: 'order',
    subject: { reference: `Patient/${patientId}` },
    medicationCodeableConcept: { text: drug }
  };
}

/**
 * order-select request: one draft MedicationRequest per current med plus the added drug
 * (the selected order), the Patient, and a genotype Observation per gene on file.
 */
export function buildRequest(patient: Patient, meds: string[], addedDrug: string): OrderSelectRequest {
  const added = addedDrug.trim().toLowerCase();
  const current: string[] = [];
  for (const med of meds.map(m => m.trim().toLowerCase())) {
    if (med && med !== added && !current.includes(med)) current.push(med);
  }

  const orders = [...current, added].map((drug, i) =>
    medicationRequest(`rxgene-order-${i + 1}`, patient.id, drug)
  );
  const selected = orders[orders.length - 1];

  const observations: Observation[] = [];
  if (patient.cyp2d6) observations.push(buildPgxObservation(patient.id, 'CYP2D6', patient.cyp2d6));
  if (patient.cyp2c19) observations.push(buildPgxObservation(patient.id, 'CYP2C19', patient.cyp2c19));

  return {
    hook: 'order-select',
    hookInstance: crypto.randomUUID(),
    context: {
      userId: DEMO_USER_ID,
      patientId: patient.id,
      selections: [`MedicationRequest/${selected.id}`],
      draftOrders: bundle(orders)
    },
    prefetch: {
      patient: { resourceType: 'Patient', id: patient.id, name: [{ text: patient.name }] },
      pgx: bundle(observations)
    }
  };
}

const INDICATORS = new Set(['info', 'warning', 'critical']);

function isCdsResponse(body: unknown): body is CdsResponse {
  if (typeof body !== 'object' || body === null) return false;
  const cards = (body as { cards?: unknown }).cards;
  return (
    Array.isArray(cards) &&
    cards.every(
      c =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as CdsCard).summary === 'string' &&
        INDICATORS.has((c as CdsCard).indicator)
    )
  );
}

type SendOptions = { timeoutMs?: number; fetchImpl?: typeof fetch; url?: string };

/**
 * POST the request with a timeout (default 3 s, covering the body read too).
 * Never throws: failures come back as { ok: false, error } so the caller can fall back.
 */
export async function send(request: OrderSelectRequest, options: SendOptions = {}): Promise<CdsExchange> {
  const timeoutMs = options.timeoutMs ?? CDS_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  let status: number | undefined;
  let body: unknown;
  try {
    const res = await fetchImpl(options.url ?? ORDER_SELECT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    status = res.status;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, status, response: body, latencyMs: elapsed() };
    if (!isCdsResponse(body)) {
      return { ok: false, error: 'Response is not a CDS Hooks { cards } object', status, response: body, latencyMs: elapsed() };
    }
    return { ok: true, status, response: body, latencyMs: elapsed() };
  } catch (err) {
    const error = controller.signal.aborted
      ? `Timed out after ${timeoutMs} ms`
      : `Network error: ${err instanceof Error ? err.message : String(err)}`;
    return { ok: false, error, status, response: body, latencyMs: elapsed() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the engine's alert level back from a card. This is the inverse of toCdsCard's
 * mapping (RED -> critical, YELLOW -> warning, GREEN/GREY -> info); GREEN cards are the
 * info cards that carry the fixed GREEN text.
 */
export function alertFromCard(card: CdsCard): Alert {
  if (card.indicator === 'critical') return 'RED';
  if (card.indicator === 'warning') return 'YELLOW';
  return card.summary.includes(GREEN_ALERT_TEXT) ? 'GREEN' : 'GREY';
}
