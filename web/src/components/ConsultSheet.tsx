// Pharmacist consult sheet (R45–R56).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Copy, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useState, useEffect, useRef } from 'react';
import { enterExit } from '@/lib/motion';

// Types from the agent API (can't use '@/' alias for api/ files from browser code).
type TraceEntry = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  ms: number;
};

type NoteSentence = {
  text: string;
  cites: string[];
};

type NoteSection = {
  heading: string;
  sentences: NoteSentence[];
};

type ConsultNote = {
  sections: NoteSection[];
};

export type { TraceEntry, NoteSentence, NoteSection, ConsultNote };

type ConsultSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: ConsultNote | null;
  source: 'ai' | 'template' | null;
  model?: string;
  trace: TraceEntry[];
  loading: boolean;
  reviewingCount?: number;
  /** When true, show a clearly-labelled "Demo preview" badge (deterministic local data, not a live agent). */
  preview?: boolean;
  /** Optional fallback reason to surface (e.g. why a template was used instead of the AI note). */
  reason?: string;
  /** Explicit error state: shows a role=alert panel with a Retry action. */
  error?: string | null;
  /** Retry callback shown next to an error. */
  onRetry?: () => void;
};

const STAGGER_MS = 100;

/**
 * Pharmacist consult sheet (R45–R56). Shows the agent's tool trace on the left and the
 * drafted note on the right. Every citation is a clickable chip that highlights and scrolls
 * to the matching trace step. R52: labeled "Draft — pharmacist review required", no send action.
 */
export function ConsultSheet({
  open,
  onOpenChange,
  note,
  source,
  model,
  trace,
  loading,
  reviewingCount,
  preview = false,
  reason,
  error = null,
  onRetry
}: ConsultSheetProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedTrace, setHighlightedTrace] = useState<string | null>(null);
  const [revealedTraceCount, setRevealedTraceCount] = useState(0);
  const reduce = !!useReducedMotion();
  const traceRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Stagger trace reveal when the note loads.
  useEffect(() => {
    if (!note || reduce || trace.length === 0) {
      setRevealedTraceCount(trace.length);
      return;
    }
    setRevealedTraceCount(0);
    let count = 0;
    const timer = setInterval(() => {
      count++;
      setRevealedTraceCount(count);
      if (count >= trace.length) clearInterval(timer);
    }, STAGGER_MS);
    return () => clearInterval(timer);
  }, [note, trace.length, reduce]);

  const copyNote = () => {
    if (!note) return;
    let text = '';
    for (const section of note.sections) {
      text += `${section.heading}\n\n`;
      for (const sentence of section.sentences) {
        const citeText = sentence.cites.length > 0 ? ` [${sentence.cites.join(', ')}]` : '';
        text += `${sentence.text}${citeText}\n`;
      }
      text += '\n';
    }
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToTrace = (id: string) => {
    const el = traceRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
      setHighlightedTrace(id);
      setTimeout(() => setHighlightedTrace(null), 1500);
    }
  };

  const sourceLabel = source === 'ai' ? `AI agent${model ? ` · ${model}` : ''}` : source === 'template' ? 'Template' : 'Draft';
  // Copy is only meaningful when there is a finished, error-free note to copy.
  const canCopy = !!note && !loading && !error;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-panel-solid p-0 overscroll-contain data-[side=right]:w-[min(1080px,94vw)]! data-[side=right]:max-w-none!"
        showCloseButton
      >
        <SheetHeader className="border-b border-ink/10 bg-[#e6f4fb] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <SheetTitle className="text-2xl font-bold text-ink">Pharmacist consult draft</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                {/* Clearly-labelled demo preview (deterministic local data, not a live agent). */}
                {preview && (
                  <Badge variant="outline" className="border-marine/40 bg-marine/10 text-marine">
                    Demo preview
                  </Badge>
                )}
                {/* R52: Draft badge — always shown. */}
                <Badge variant="outline" className="border-alert-amber/40 bg-alert-amber/10 text-alert-amber">
                  Draft — pharmacist review required
                </Badge>
                {/* Source: AI agent or template. */}
                <Badge variant="outline" className="text-ink-muted">
                  {sourceLabel}
                </Badge>
              </div>
            </div>
            {canCopy && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyNote}
                className="press shrink-0 mr-8"
              >
                {copied ? (
                  <>
                    <Check className="size-4" strokeWidth={2} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" strokeWidth={2} />
                    Copy note
                  </>
                )}
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Explicit error state: a role=alert panel with an optional Retry callback. */}
        {error && (
          <div
            role="alert"
            data-trace="consult-error"
            className="mx-6 mt-5 flex items-start justify-between gap-4 rounded-lg border border-alert-red/40 bg-alert-red/5 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-alert-red" strokeWidth={2} />
              <p className="text-sm text-ink">{error}</p>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="press shrink-0">
                <RotateCcw className="size-4" strokeWidth={2} />
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Fallback reason (e.g. why a template is shown instead of the AI note). */}
        {!error && reason && (
          <p className="mx-6 mt-5 rounded-lg border border-marine/30 bg-marine/5 px-4 py-2 text-sm text-ink">{reason}</p>
        )}

        <div className="flex h-[calc(100vh-8rem)] min-h-0 overflow-hidden">
          {/* Left: Tool trace (R53) */}
          <div className="w-[300px] shrink-0 overflow-y-auto overscroll-contain border-r border-ink/10 p-6">
            <h3 className="mb-4 text-sm font-semibold text-ink-muted">Agent trace</h3>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={2} />
                Agent reviewing {reviewingCount ?? 0} medications…
              </div>
            )}
            {!loading && !error && trace.length === 0 && (
              <p className="text-sm text-ink-muted">No trace available.</p>
            )}
            <ol className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {trace.slice(0, revealedTraceCount).map((t, idx) => (
                  <motion.li
                    key={t.id}
                    data-trace-id={t.id}
                    ref={(el) => { if (el) traceRefs.current.set(t.id, el); }}
                    {...(reduce ? {} : enterExit(reduce, idx * 0.1))}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      highlightedTrace === t.id
                        ? 'border-marine bg-[#dceff8]'
                        : 'border-ink/10 bg-ink/5'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 font-mono text-xs text-ink-muted">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 font-mono text-xs text-ink-muted">{t.tool}</p>
                        <p className="break-words text-ink">{t.summary}</p>
                        <p className="mt-1 text-xs text-ink-muted">{t.ms} ms</p>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>

          {/* Right: Consult note */}
          <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-6">
            {loading && (
              <div className="flex items-center gap-2 text-ink-muted">
                <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" strokeWidth={2} />
                Generating note…
              </div>
            )}
            {!loading && error && (
              <p className="text-ink-muted">The consult note could not be generated. Use Retry above.</p>
            )}
            {!loading && !error && !note && (
              <p className="text-ink-muted">No note available.</p>
            )}
            {!loading && !error && note && (
              <div className="flex max-w-prose flex-col gap-6">
                {note.sections.map((section, secIdx) => (
                  <section key={secIdx} data-trace="consult-section" className="flex flex-col gap-3">
                    <h3 className="text-lg font-semibold text-ink">{section.heading}</h3>
                    <div className="flex flex-col gap-2">
                      {section.sentences.map((sentence, sentIdx) => (
                        <p key={sentIdx} className="text-base text-ink">
                          {sentence.text}{' '}
                          {sentence.cites.map((cite, citeIdx) => (
                            <button
                              key={citeIdx}
                              onClick={() => scrollToTrace(cite)}
                              onMouseEnter={() => setHighlightedTrace(cite)}
                              onMouseLeave={() => setHighlightedTrace(null)}
                              onFocus={() => setHighlightedTrace(cite)}
                              onBlur={() => setHighlightedTrace(null)}
                              data-cite={cite}
                              className="inline-flex items-center justify-center rounded bg-[#dceff8] px-1.5 py-0.5 font-mono text-xs text-marine transition-colors hover:bg-[#c7e4f3] focus:outline-none focus:ring-2 focus:ring-marine focus:ring-offset-1"
                              aria-label={`Citation ${cite}`}
                            >
                              [{trace.findIndex(t => t.id === cite) + 1}]
                            </button>
                          ))}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-ink/10 px-6 py-3 text-right text-xs text-ink-muted">
          Draft generated by RxGene agent · Requires pharmacist review before charting
        </div>
      </SheetContent>
    </Sheet>
  );
}
