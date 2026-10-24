import { ORDER_SELECT_PATH, type CdsExchange, type OrderSelectRequest } from '@/lib/cdsClient';

type CdsExchangePanelProps = {
  request: OrderSelectRequest;
  /** null while the call is in flight. */
  result: CdsExchange | null;
};

const json = (value: unknown) => JSON.stringify(value ?? null, null, 2);

const PRE = 'max-h-80 overflow-auto overscroll-contain rounded-lg bg-ink/5 p-3 font-mono text-xs leading-5 text-ink';

/** Expandable view of the last CDS Hooks call: JSON sent, JSON received, latency. */
export function CdsExchangePanel({ request, result }: CdsExchangePanelProps) {
  const status = !result ? 'waiting…' : result.ok ? `${result.latencyMs} ms` : `failed after ${result.latencyMs} ms`;

  return (
    <details className="group rounded-lg border border-ink/15 bg-panel-solid">
      <summary className="cursor-pointer px-4 py-3 text-base font-semibold text-ink">
        Request / Response ({status})
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4 text-sm text-ink">
        <p>
          POST {ORDER_SELECT_PATH}
          {result?.status !== undefined && ` → HTTP ${result.status}`}
          {result && ` · latency ${result.latencyMs} ms`}
        </p>
        {result && !result.ok && <p>Error: {result.error}. The result shown comes from the local fallback.</p>}

        <h4 className="font-semibold">Request</h4>
        <pre tabIndex={0} className={PRE}>
          {json(request)}
        </pre>

        <h4 className="font-semibold">Response</h4>
        <pre tabIndex={0} className={PRE}>
          {result ? json(result.response) : '…'}
        </pre>
      </div>
    </details>
  );
}
