// Guards the consult request body shape (patient fields + addedDrug) that RxGeneConnected.tsx
// sends to POST /api/consult, matching web/api/consult.ts's expected body. Kept separate from
// consultFetch.test.ts's stale-response tests. Deliberately avoids importing the .tsx component
// tree here (RxGeneConnected/RxGeneUI/shadcn) — this vitest config runs in a plain node
// environment (vite.config.ts test.environment = 'node'), and every other test file in this
// repo keeps to pure, framework-free modules for that reason.
import { describe, expect, it, vi } from 'vitest';
import { fetchConsult, type ConsultRequestPatient } from './consultFetch';

function okResponse(): Response {
  return new Response(JSON.stringify({ note: { sections: [] }, source: 'template', trace: [], ms: 0 }), { status: 200 });
}

describe('fetchConsult request body', () => {
  it('POSTs { patient, addedDrug } as JSON, with patient carrying id/name/genes/meds', async () => {
    const patient: ConsultRequestPatient = {
      id: 'P01',
      name: 'Sarah',
      cyp2d6: '*1/*1',
      meds: ['fluoxetine'],
    };
    const mockFetch = vi.fn<typeof fetch>(async () => okResponse());

    await fetchConsult(patient, 'codeine', () => false, mockFetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/consult');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init!.body as string)).toEqual({ patient, addedDrug: 'codeine' });
  });

  it('omits addedDrug when there is no drug being checked', async () => {
    const patient: ConsultRequestPatient = { id: 'P03', name: 'Priya', cyp2d6: '*1/*1', meds: [] };
    const mockFetch = vi.fn<typeof fetch>(async () => okResponse());

    await fetchConsult(patient, undefined, () => false, mockFetch);

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.addedDrug).toBeUndefined();
    expect(body.patient).toEqual(patient);
  });
});
