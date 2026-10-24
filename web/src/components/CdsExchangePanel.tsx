import { ORDER_SELECT_PATH, type CdsExchange, type OrderSelectRequest } from '@/lib/cdsClient';

type CdsExchangePanelProps = {
  request: OrderSelectRequest;
  /** null while the call is in flight. */
  result: CdsExchange | null;
};

const json = (value: unknown) => JSON.stringify(value ?? null, null, 2);

/** Expandable view of the last CDS Hooks call: JSON sent, JSON received, latency. */
export function CdsExchangePanel({ request, result }: CdsExchangePanelProps) {
  const status = !result ? 'waiting…' : result.ok ? `${result.latencyMs} ms` : `failed after ${result.latencyMs} ms`;

  return (
    <details>
      <summary>Request / Response ({status})</summary>
      <p>
        POST {ORDER_SELECT_PATH}
        {result?.status !== undefined && ` → HTTP ${result.status}`}
        {result && ` · latency ${result.latencyMs} ms`}
      </p>
      {result && !result.ok && <p>Error: {result.error}. Cards below come from the local fallback.</p>}

      <h3>Request</h3>
      <pre tabIndex={0} className="max-h-96 overflow-auto text-xs">
        {json(request)}
      </pre>

      <h3>Response</h3>
      <pre tabIndex={0} className="max-h-96 overflow-auto text-xs">
        {result ? json(result.response) : '…'}
      </pre>
    </details>
  );
}
