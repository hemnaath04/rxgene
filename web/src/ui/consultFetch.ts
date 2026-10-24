// POST /api/consult with a stale-response guard. Pure, framework-free (no React import), so
// it can be unit tested with a mocked fetch exactly like lib/cdsClient.ts's `send`. The caller
// (RxGeneConnected.tsx) owns the epoch/ref that decides `isStale`; this module only sequences
// the request and reports a typed outcome — it makes no clinical decision and renders nothing.

export type ConsultRequestPatient = { id: string; name: string; cyp2d6?: string; cyp2c19?: string; meds: string[] };

// Agent result type (browser can't import from api/ directly).
export type ConsultAgentResult = {
  note: {
    sections: Array<{
      heading: string;
      sentences: Array<{ text: string; cites: string[] }>;
    }>;
  };
  source: 'ai' | 'template';
  reason?: string;
  trace: Array<{ id: string; tool: string; args: Record<string, unknown>; summary: string; ms: number }>;
  model?: string;
  ms: number;
};

export type ConsultFetchOutcome =
  | { kind: 'ok'; data: ConsultAgentResult }
  | { kind: 'http-error'; status: number }
  | { kind: 'network-error'; message: string }
  | { kind: 'stale' };

/**
 * POST /api/consult and resolve to a typed outcome. `isStale` is read AFTER the response comes
 * back, and again after the body is parsed, so a patient/med change that happens while the
 * request is in flight is caught before the caller ever applies the data to visible state.
 */
export async function fetchConsult(
  patient: ConsultRequestPatient,
  addedDrug: string | undefined,
  isStale: () => boolean,
  fetchImpl: typeof fetch = fetch
): Promise<ConsultFetchOutcome> {
  try {
    const response = await fetchImpl('/api/consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient, addedDrug }),
    });

    if (isStale()) return { kind: 'stale' };
    if (!response.ok) return { kind: 'http-error', status: response.status };

    const data = (await response.json()) as ConsultAgentResult;
    if (isStale()) return { kind: 'stale' };
    return { kind: 'ok', data };
  } catch (err) {
    if (isStale()) return { kind: 'stale' };
    return { kind: 'network-error', message: err instanceof Error ? err.message : String(err) };
  }
}
