import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { MismatchWarning, ViaBadge } from '@/components/AlertCard';
import { LevelIcon } from '@/components/AlertLevel';
import { Button } from '@/components/ui/button';
import type { Verdict } from '@/lib/verdict';

type VerdictBarProps = {
  verdict: Verdict;
  /** Number of other alerts in this check ("+1 more alert"). */
  moreCount: number;
  onInspect: () => void;
  onMore: () => void;
  onExplain: () => void;
  explainDisabled: boolean;
  onReviewMeds: () => void;
};

/** Longest note line the slim bar shows; anything longer is truncated and lives in full in the sheet. */
const NOTE_MAX = 120;

/**
 * The one short note the slim bar carries: the inhibitor / de-escalation / weak note, or the
 * reduced-confidence caveat, whichever comes first. Truncated to ~120 chars. The full text (this
 * note, plus every other note, quote, label recommendation, CPIC role, genotype recommendation and
 * source links) stays in the Evidence sheet.
 */
function shortNote(v: Verdict): string | null {
  const note = v.notes[0];
  if (!note) return null;
  if (note.length <= NOTE_MAX) return note;
  return `${note.slice(0, NOTE_MAX - 1).trimEnd()}…`;
}

/**
 * Slim verdict bar (DESIGN.md sections 1 and 3). It sits in normal flow after the gauge and the
 * comparison strip (not sticky), so it never covers the "Slow" result or the gauge on load.
 * It shows only: the headline, one plain sentence, at most one short note line, the source line,
 * the via badge and the two actions. Everything longer moves into the Evidence sheet, which the
 * "Inspect evidence" button opens.
 */
export function VerdictBar({ verdict: v, moreCount, onInspect, onMore, onExplain, explainDisabled, onReviewMeds }: VerdictBarProps) {
  const note = shortNote(v);
  return (
    <section
      aria-labelledby="verdict-heading"
      className="rounded-2xl bg-verdict text-white shadow-[0_12px_40px_-12px_oklch(0.2_0.05_240/0.5)]"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-8 lg:p-7">
        <div className="flex min-w-0 items-start gap-4 lg:w-[38%] lg:shrink-0">
          <LevelIcon level={v.level} className="mt-1 size-9 sm:size-11" strokeWidth={2} />
          <div className="flex min-w-0 flex-col gap-1">
            {/* Reverse case (DESIGN.md section 3): the alert is about the current med, not the one just added. */}
            {v.prefix && <p className="text-base text-verdict-muted">{v.prefix}</p>}
            {!v.prefix && <p className="text-base text-verdict-muted">Prescription review</p>}
            <h2
              id="verdict-heading"
              className="text-[26px]/[30px] font-bold tracking-[-0.02em] text-balance break-words sm:text-[34px]/[38px]"
            >
              {v.headline}
            </h2>
            {/* R31: GREEN is the genotype result only, not an overall medication clearance. */}
            {v.qualifier && <p className="text-base font-medium text-verdict-muted">{v.qualifier}</p>}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 break-words lg:border-l lg:border-white/20 lg:pl-8">
          {v.mismatch && <MismatchWarning text={v.mismatch} className="rounded-lg bg-white/10 px-3 py-2 text-white" />}
          <p className="text-base/6">{v.sentence}</p>
          {note && <p className="text-sm text-white/90">{note}</p>}
          {(v.source || v.population) && (
            <p className="text-sm text-verdict-muted">{[v.source, v.population].filter(Boolean).join(' · ')}</p>
          )}
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <ViaBadge via={v.via} className="border-white/40 text-white" />
            {moreCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="press text-white underline underline-offset-4 hover:bg-white/10 hover:text-white"
                onClick={onMore}
              >
                +{moreCount} more alert{moreCount > 1 ? 's' : ''}
              </Button>
            )}
          </div>
          <Button
            className="press h-11 rounded-lg bg-[oklch(0.93_0.04_220)] pr-[18px]! pl-5! text-base font-semibold text-ink hover:bg-white"
            onClick={onInspect}
          >
            Inspect evidence
            <ArrowUpRight aria-hidden="true" className="size-5" strokeWidth={2} />
          </Button>
          <Button
            variant="ghost"
            className="press h-9 pr-1.5! pl-2! text-base font-semibold text-white underline underline-offset-4 hover:bg-white/10 hover:text-white"
            onClick={onExplain}
            disabled={explainDisabled}
          >
            Patient explanation
            <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2} />
          </Button>
          <Button
            variant="ghost"
            className="press h-9 pr-1.5! pl-2! text-base font-semibold text-white underline underline-offset-4 hover:bg-white/10 hover:text-white"
            onClick={onReviewMeds}
          >
            Review full medication list
            <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2} />
          </Button>
        </div>
      </div>
      <p className="border-t border-white/10 px-6 py-2.5 text-right text-xs text-verdict-muted lg:px-7">
        Hackathon prototype · Synthetic data only · For clinician review
      </p>
    </section>
  );
}
