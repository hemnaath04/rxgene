// Adapter test: the consult fetch helper discards a response that arrives after the patient
// or medication list changed mid-flight (the stale-response guard described in the brief).
// Mirrors lib/cdsClient.test.ts's style: a mocked fetchImpl, no React import needed since the
// guard itself is a plain async function with an explicit `isStale` check (see consultFetch.ts).
import { describe, expect, it, vi } from 'vitest';
import { fetchConsult, type ConsultRequestPatient } from './consultFetch';

const sarah: ConsultRequestPatient = { id: 'P01', name: 'Sarah', cyp2d6: '*1/*1', meds: ['fluoxetine'] };

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('fetchConsult', () => {
  it('resolves ok when the request is still current when the response arrives', async () => {
    const payload = { note: { sections: [] }, source: 'template' as const, trace: [], ms: 0 };
    const mockFetch = vi.fn<typeof fetch>(async () => okResponse(payload));

    const outcome = await fetchConsult(sarah, 'codeine', () => false, mockFetch);

    expect(outcome).toEqual({ kind: 'ok', data: payload });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/consult',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('discards the response as stale when the patient/meds changed mid-flight', async () => {
    const payload = { note: { sections: [] }, source: 'template' as const, trace: [], ms: 0 };
    // isStale becomes true only AFTER the fetch has been issued (simulating a change that
    // happens while the request is in flight, e.g. the user switched patients).
    let staleNow = false;
    const mockFetch = vi.fn<typeof fetch>(async () => {
      staleNow = true; // the "change" happens while the network call is pending
      return okResponse(payload);
    });

    const outcome = await fetchConsult(sarah, 'codeine', () => staleNow, mockFetch);

    expect(outcome).toEqual({ kind: 'stale' });
  });

  it('discards a stale result even when the body read also completes after the change', async () => {
    const payload = { note: { sections: [] }, source: 'template' as const, trace: [], ms: 0 };
    let changed = false;
    const response = okResponse(payload);
    // Simulate the change landing between the headers resolving and the JSON body being read.
    const originalJson = response.json.bind(response);
    response.json = async () => {
      changed = true;
      return originalJson();
    };
    const mockFetch = vi.fn<typeof fetch>(async () => response);

    const outcome = await fetchConsult(sarah, 'codeine', () => changed, mockFetch);

    expect(outcome).toEqual({ kind: 'stale' });
  });

  it('reports an HTTP error when the request is current', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () => new Response('nope', { status: 500 }));
    const outcome = await fetchConsult(sarah, 'codeine', () => false, mockFetch);
    expect(outcome).toEqual({ kind: 'http-error', status: 500 });
  });

  it('reports a network error when the request is current', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () => {
      throw new Error('boom');
    });
    const outcome = await fetchConsult(sarah, 'codeine', () => false, mockFetch);
    expect(outcome).toEqual({ kind: 'network-error', message: 'boom' });
  });

  it('discards a network error that only becomes known after the change', async () => {
    let changed = false;
    const mockFetch = vi.fn<typeof fetch>(async () => {
      changed = true;
      throw new Error('boom');
    });
    const outcome = await fetchConsult(sarah, 'codeine', () => changed, mockFetch);
    expect(outcome).toEqual({ kind: 'stale' });
  });
});
