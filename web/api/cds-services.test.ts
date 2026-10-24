// CDS Hooks handler tests: discovery and order-select (build spec section 8).
import { describe, it, expect } from 'vitest';
import { GET } from './cds-services';
import { POST } from './cds-services/rxgene-order-select';
import { buildPgxObservation, medsFromRequest, parseGenotype } from './_lib/fhir';
import type { Gene, Observation } from './_lib/fhir';

type Card = { summary: string; detail: string; indicator: string };

function medicationRequest(id: string, name: string) {
  return {
    resourceType: 'MedicationRequest',
    id,
    status: 'draft',
    intent: 'order',
    subject: { reference: 'Patient/P01' },
    medicationCodeableConcept: { text: name }
  };
}

function medicationOrder(id: string, name: string, status: string = 'draft') {
  return {
    resourceType: 'MedicationOrder',
    id,
    status,
    patient: { reference: 'Patient/P01' },
    medicationCodeableConcept: { text: name }
  };
}

function bundle(resources: object[]) {
  return { resourceType: 'Bundle', type: 'collection', entry: resources.map(resource => ({ resource })) };
}

/** An order-select request: current meds + the added drug as draft orders, the added one selected. */
function orderSelect(opts: { patientId: string; meds: string[]; add: string; pgx?: Observation[] }) {
  const orders = [...opts.meds, opts.add].map((drug, i) => medicationRequest(`mr-${i}`, drug));
  const selectedId = orders[orders.length - 1].id;
  return {
    hook: 'order-select',
    hookInstance: 'd1577c69-dfbe-44ad-ba6d-3e05e953b2ea',
    context: {
      userId: 'Practitioner/example',
      patientId: opts.patientId,
      selections: [`MedicationRequest/${selectedId}`],
      draftOrders: bundle(orders)
    },
    prefetch: {
      patient: { resourceType: 'Patient', id: opts.patientId },
      ...(opts.pgx ? { pgx: bundle(opts.pgx) } : {})
    }
  };
}

async function post(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/cds-services/rxgene-order-select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    })
  );
}

async function cardsFor(body: unknown): Promise<Card[]> {
  const res = await post(body);
  expect(res.status).toBe(200);
  const json = (await res.json()) as { cards: Card[] };
  return json.cards;
}

describe('GET /cds-services (discovery)', () => {
  it('returns exactly one order-select service with the prefetch templates', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    const [service] = json.services;
    expect(service.id).toBe('rxgene-order-select');
    expect(service.hook).toBe('order-select');
    expect(service.title).toBeTruthy();
    expect(service.description).toBeTruthy();
    expect(service.prefetch).toEqual({
      patient: 'Patient/{{context.patientId}}',
      pgx: 'Observation?patient={{context.patientId}}&code=http://loinc.org|84413-4',
      medications: 'MedicationRequest?patient={{context.patientId}}&status=active'
    });
  });
});

describe('POST /cds-services/rxgene-order-select', () => {
  it('P01: *1/*1 + fluoxetine, add codeine -> one critical card, summary < 140 chars', async () => {
    const cards = await cardsFor(
      orderSelect({
        patientId: 'P01',
        meds: ['fluoxetine'],
        add: 'codeine',
        pgx: [buildPgxObservation('P01', 'CYP2D6', '*1/*1')]
      })
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].indicator).toBe('critical');
    expect(cards[0].summary.length).toBeLessThan(140);
    expect(cards[0].summary).toContain('codeine');
    expect(cards[0].detail).toContain('Poor Metabolizer');
  });

  it('no pgx Observation -> Insufficient data card', async () => {
    const cards = await cardsFor(orderSelect({ patientId: 'P01', meds: ['fluoxetine'], add: 'codeine' }));
    expect(cards).toHaveLength(1);
    expect(cards[0].indicator).toBe('info');
    expect(cards[0].summary).toContain('Insufficient data');
  });

  it('DSTU2 MedicationOrder with no pgx -> one info card with Insufficient-data text', async () => {
    const request = {
      hook: 'order-select',
      hookInstance: 'd1577c69-dfbe-44ad-ba6d-3e05e953b2ea',
      context: {
        userId: 'Practitioner/example',
        patientId: 'P-dstu2',
        selections: ['MedicationOrder/order-1'],
        draftOrders: bundle([medicationOrder('order-1', 'Codeine sulfate 30 MG Oral Tablet')])
      },
      prefetch: {
        patient: { resourceType: 'Patient', id: 'P-dstu2' }
      }
    };
    const cards = await cardsFor(request);
    expect(cards).toHaveLength(1);
    expect(cards[0].indicator).toBe('info');
    expect(cards[0].summary).toContain('Insufficient data');
  });

  it('P02: *4/*4 + fluoxetine, add codeine -> critical + "adds no further effect" note', async () => {
    const cards = await cardsFor(
      orderSelect({
        patientId: 'P02',
        meds: ['fluoxetine'],
        add: 'codeine',
        pgx: [buildPgxObservation('P02', 'CYP2D6', '*4/*4')]
      })
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].indicator).toBe('critical');
    expect(cards[0].detail).toContain('adds no further effect');
  });

  it('invalid body -> 400 with a JSON error', async () => {
    for (const body of ['not json', { hook: 'order-select' }, { context: {} }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe('string');
    }
  });
});

describe('fhir mapping', () => {
  const geneObs = (gene: Gene, value: Partial<Observation>): Observation => {
    const obs = buildPgxObservation('X', gene, '*1/*1');
    delete obs.valueCodeableConcept;
    return { ...obs, ...value };
  };

  it('round-trips buildPgxObservation for both genes', () => {
    const b = bundle([
      buildPgxObservation('X', 'CYP2D6', '*1x2/*2'),
      buildPgxObservation('X', 'CYP2C19', '*2/*2')
    ]);
    expect(parseGenotype(b, 'CYP2D6')).toBe('*1x2/*2');
    expect(parseGenotype(b, 'CYP2C19')).toBe('*2/*2');
  });

  it('strips gene prefixes and suballele suffixes from text, valueString and coding display', () => {
    expect(parseGenotype(bundle([geneObs('CYP2D6', { valueCodeableConcept: { text: 'CYP2D6*1.001/CYP2D6*4.001' } })]), 'CYP2D6')).toBe('*1/*4');
    expect(parseGenotype(bundle([geneObs('CYP2D6', { valueString: 'CYP2D6 *1/*10' })]), 'CYP2D6')).toBe('*1/*10');
    expect(
      parseGenotype(bundle([geneObs('CYP2C19', { valueCodeableConcept: { coding: [{ display: 'CYP2C19*1/*2' }] } })]), 'CYP2C19')
    ).toBe('*1/*2');
  });

  it('returns null for a missing, other-gene or unparsable Observation', () => {
    expect(parseGenotype(undefined, 'CYP2D6')).toBeNull();
    expect(parseGenotype(bundle([buildPgxObservation('X', 'CYP2C19', '*1/*1')]), 'CYP2D6')).toBeNull();
    expect(parseGenotype(bundle([geneObs('CYP2D6', { valueString: 'positive' })]), 'CYP2D6')).toBeNull();
  });

  it('medsFromRequest matches draft orders and active meds case-insensitively', () => {
    const result = medsFromRequest(
      {
        selections: ['MedicationRequest/new'],
        draftOrders: bundle([medicationRequest('new', 'Codeine sulfate 30 mg oral tablet')]) as never
      },
      {
        medications: bundle([
          { ...medicationRequest('a', 'FLUOXETINE 20 MG CAPSULE'), status: 'active' },
          { ...medicationRequest('b', 'paroxetine'), status: 'stopped' },
          { ...medicationRequest('c', 'acetaminophen'), status: 'active' }
        ]) as never
      }
    );
    expect(result.selected).toBe('codeine');
    expect(result.meds.sort()).toEqual(['codeine', 'fluoxetine']);
  });

  it('medsFromRequest handles DSTU2 MedicationOrder with draft or active status', () => {
    const result = medsFromRequest(
      {
        selections: ['MedicationOrder/new'],
        draftOrders: bundle([medicationOrder('new', 'Codeine sulfate 30 mg oral tablet', 'draft')]) as never
      },
      {
        medications: bundle([
          medicationOrder('a', 'FLUOXETINE 20 MG CAPSULE', 'active'),
          medicationOrder('b', 'paroxetine', 'stopped'),
          medicationOrder('c', 'acetaminophen', 'draft')
        ]) as never
      }
    );
    expect(result.selected).toBe('codeine');
    expect(result.meds.sort()).toEqual(['codeine', 'fluoxetine']);
  });

});