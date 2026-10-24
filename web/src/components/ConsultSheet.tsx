// Pharmacist consult sheet (R45–R56).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Copy, LoaderCircle } from 'lucide-react';
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

type ConsultSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: ConsultNote | null;
  source: 'ai' | 'template' | null;
  model?: string;
  trace: TraceEntry[];
  loading: boolean;
  reviewingCount?: number;
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
  reviewingCount
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
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setHighlightedTrace(id);
      setTimeout(() => setHighlightedTrace(null), 1500);
    }
  };

  const sourceLabel = source === 'ai' ? `AI agent${model ? ` · ${model}` : ''}` : 'Template';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-4xl p-0 sm:max-w-4xl overscroll-contain"
        showCloseButton
      >
        <SheetHeader className="border-b border-ink/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <SheetTitle className="text-2xl font-bold text-ink">Pharmacist consult draft</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                {/* R52: Draft badge */}
                <Badge variant="outline" className="border-alert-amber/40 bg-alert-amber/10 text-alert-amber">
                  Draft — pharmacist review required
                </Badge>
                <Badge variant="outline" className="text-ink-muted">
                  {sourceLabel}
                </Badge>
              </div>
            </div>
            {note && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyNote}
                className="press shrink-0"
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

        <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
          {/* Left: Tool trace (R53) */}
          <div className="w-80 shrink-0 border-r border-ink/10 overflow-y-auto p-6">
            <h3 className="text-sm font-semibold text-ink-muted mb-4">Agent trace</h3>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />
                Agent reviewing {reviewingCount ?? 0} medications…
              </div>
            )}
            {!loading && trace.length === 0 && (
              <p className="text-sm text-ink-muted">No trace available.</p>
            )}
            <ol className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {trace.slice(0, revealedTraceCount).map((t, idx) => (
                  <motion.li
                    key={t.id}
                    ref={(el) => { if (el) traceRefs.current.set(t.id, el); }}
                    {...(reduce ? {} : enterExit(reduce, idx * 0.1))}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      highlightedTrace === t.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-ink/10 bg-ink/5'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 font-mono text-xs text-ink-muted">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-ink-muted mb-0.5">{t.tool}</p>
                        <p className="text-ink break-words">{t.summary}</p>
                        <p className="text-xs text-ink-muted mt-1">{t.ms} ms</p>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>

          {/* Right: Consult note */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex items-center gap-2 text-ink-muted">
                <LoaderCircle className="size-5 animate-spin" strokeWidth={2} />
                Generating note…
              </div>
            )}
            {!loading && !note && (
              <p className="text-ink-muted">No note available.</p>
            )}
            {!loading && note && (
              <div className="flex flex-col gap-6 max-w-prose">
                {note.sections.map((section, secIdx) => (
                  <section key={secIdx} className="flex flex-col gap-3">
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
                              className="inline-flex items-center justify-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono text-blue-700 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
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

        <div className="border-t border-ink/10 px-6 py-3 text-xs text-ink-muted text-right">
          Draft generated by RxGene agent · Requires pharmacist review before charting
        </div>
      </SheetContent>
    </Sheet>
  );
}
