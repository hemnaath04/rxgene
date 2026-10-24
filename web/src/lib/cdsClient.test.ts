import { describe, it, expect } from 'vitest';
import { POST } from '../../api/cds-services/rxgene-order-select';
import { patients } from '@/data/patients';
import { checkOrder, toCdsCard } from '@/engine';
import type { CdsCard } from '@/engine/types';
import { cdsEntries } from './cardEntries';
import { alertFromCard, buildRequest, send, DEMO_USER_ID, type OrderSelectRequest } from './cdsClient';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Call the order-select handler directly (no network). */
async function callHandler(request: OrderSelectRequest): Promise<CdsCard[]> {
  const res = await POST(
    new Request('http://localhost/cds-services/rxgene-order-select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { cards: CdsCard[] }).cards;
}

const sarah = patients.find(p => p.id === 'P01')!;

describe('cdsClient.buildRequest', () => {
  it('builds an order-select request with draft orders, selection and prefetch', () => {
    const req = buildRequest(sarah, ['fluoxetine'], 'codeine');

    expect(req.hook).toBe('order-select');
    expect(req.hookInstance).toMatch(UUID);
    expect(buildRequest(sarah, ['fluoxetine'], 'codeine').hookInstance).not.toBe(req.hookInstance);
    expect(req.context.userId).toBe(DEMO_USER_ID);
    expect(req.context.patientId).toBe('P01');

    const orders = req.context.draftOrders.entry!.map(e => e.resource as { id: string; resourceType: string; medicationCodeableConcept: { text: string } });
    expect(orders.map(o => o.resourceType)).toEqual(['MedicationRequest', 'MedicationRequest']);
    expect(orders.map(o => o.medicationCodeableConcept.text)).toEqual(['fluoxetine', 'codeine']);
    expect(req.context.selections).toEqual([`MedicationRequest/${orders[1].id}`]);

    expect(req.prefetch.patient).toMatchObject({ resourceType: 'Patient', id: 'P01' });
    expect(req.prefetch.pgx.entry).toHaveLength(1); // CYP2D6 only
  });

  it('does not duplicate the added drug if it is already in meds', () => {
    const req = buildRequest(sarah, ['fluoxetine', 'codeine'], 'codeine');
    expect(req.context.draftOrders.entry).toHaveLength(2);
  });

  it('is accepted by the order-select handler, which returns the case 1 RED card', async () => {
    const cards = await callHandler(buildRequest(sarah, ['fluoxetine'], 'codeine'));
    expect(cards).toHaveLength(1);
    expect(cards[0].indicator).toBe('critical');
    expect(alertFromCard(cards[0])).toBe('RED');
  });

  it('server cards agree with the local engine for every preset patient', async () => {
    for (const p of patients) {
      const cards = await callHandler(buildRequest(p, p.meds, p.demoDrug));
      const local = checkOrder({ ...p, meds: p.meds }, p.demoDrug);
      expect(cards).toEqual(local.map(toCdsCard));
      for (const entry of cdsEntries(p.demoDrug, cards, local)) {
        expect(entry.kind === 'assessment' && entry.mismatch).toBeFalsy();
      }
    }
  });
});

describe('cardEntries.cdsEntries', () => {
  it('shows the server level and flags a mismatch when it differs from the local engine', () => {
    const local = checkOrder({ ...sarah, meds: ['fluoxetine'] }, 'codeine');
    const tampered: CdsCard = { ...toCdsCard(local[0]), indicator: 'warning' };
    const [entry] = cdsEntries('codeine', [tampered], local);
    expect(entry.kind).toBe('assessment');
    if (entry.kind !== 'assessment') return;
    expect(entry.alert).toBe('YELLOW');
    expect(entry.via).toBe('cds-hooks');
    expect(entry.mismatch).toContain('RED');
  });
});

describe('cdsClient.send', () => {
  const request = buildRequest(sarah, ['fluoxetine'], 'codeine');

  it('returns the cards and latency on success', async () => {
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const cards = await callHandler(JSON.parse(String(init!.body)));
      return Response.json({ cards });
    }) as typeof fetch;
    const result = await send(request, { fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(200);
    expect(result.response.cards[0].indicator).toBe('critical');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('times out with an AbortController and reports it', async () => {
    const hang = ((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })) as typeof fetch;
    const result = await send(request, { fetchImpl: hang, timeoutMs: 20 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Timed out');
  });

  it('reports HTTP errors and malformed bodies as failures', async () => {
    const bad = (async () => Response.json({ error: 'nope' }, { status: 500 })) as typeof fetch;
    expect((await send(request, { fetchImpl: bad })).ok).toBe(false);
    const malformed = (async () => Response.json({ notCards: true })) as typeof fetch;
    expect((await send(request, { fetchImpl: malformed })).ok).toBe(false);
  });
});
