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
};

/**
 * Compact horizontal deep-petrol verdict strip (visual brief section 10):
 * icon + headline left, rationale + caveats + source middle, evidence/explanation right.
 *
 * The long verbatim CPIC recommendation (`v.quote`) is intentionally NOT rendered in the band
 * so it doesn't crowd the result — it stays in full in the Evidence sheet. The plain sentence,
 * every caveat/note, any mismatch warning, and the source line all remain here. Wraps naturally
 * on smaller viewports.
 */
export function VerdictBar({ verdict: v, moreCount, onInspect, onMore, onExplain, explainDisabled }: VerdictBarProps) {
  return (
    <section
      aria-labelledby="verdict-heading"
      className="rounded-2xl bg-verdict text-white shadow-[0_16px_44px_-16px_oklch(0.2_0.05_240/0.6)]"
    >
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:gap-6 lg:px-6 lg:py-4">
        {/* Left: icon + headline */}
        <div className="flex items-start gap-3 lg:w-[32%] lg:shrink-0">
          <LevelIcon level={v.level} className="mt-0.5 size-8 lg:size-9" strokeWidth={2} />
          <div className="flex min-w-0 flex-col">
            {v.prefix && <p className="text-xs text-verdict-muted">{v.prefix}</p>}
            <p className="text-xs text-verdict-muted">Prescription review</p>
            <h2 id="verdict-heading" className="text-[26px]/[30px] font-bold tracking-[-0.02em] text-balance lg:text-[30px]/[34px]">
              {v.headline}
            </h2>
            {v.qualifier && <p className="text-sm font-medium text-verdict-muted">{v.qualifier}</p>}
          </div>
        </div>

        {/* Middle: rationale + full clinical content + source. Compact styling, but no
            clinical content is dropped — special cases (FDA label first, genotype vs converted
            recommendation, differing-context flag) may make the band taller, which is correct. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:border-l lg:border-white/20 lg:pl-6">
          {v.mismatch && <MismatchWarning text={v.mismatch} className="rounded-lg bg-white/10 px-3 py-1.5 text-white" />}
          {/* R17: FDA label recommendation applies directly; show it first. */}
          {v.labelRecommendation && (
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <p className="text-sm font-semibold text-white">FDA label (applies directly)</p>
              <p className="text-[15px] text-white/90">{v.labelRecommendation}</p>
            </div>
          )}
          <p className="text-[15px]/6">{v.sentence}</p>
          {v.quote && <blockquote className="border-l-2 border-white/30 pl-3 text-sm text-white/90">{v.quote}</blockquote>}
          {/* R20: show the genotype (unconverted) recommendation alongside the converted one. */}
          {v.genotypeRecommendation && (
            <blockquote className="border-l-2 border-white/30 pl-3 text-sm text-white/90">
              <span className="font-semibold">Genotype recommendation: </span>
              {v.genotypeRecommendation}
            </blockquote>
          )}
          {/* R17: the two guidance contexts are not interchangeable. */}
          {v.discrepancyFlag && <p className="text-xs text-verdict-muted">{v.discrepancyFlag}</p>}
          {v.notes.map(note => (
            <p key={note} className="text-sm text-white/85">
              {note}
            </p>
          ))}
          {v.source && <p className="text-xs text-verdict-muted">{v.source}</p>}
        </div>

        {/* Right: badge + actions */}
        <div className="flex flex-col items-start gap-2 lg:items-end">
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
          <div className="flex items-center gap-2">
            <Button
              className="press h-10 rounded-lg bg-[oklch(0.93_0.04_220)] pr-4! pl-4! text-sm font-semibold text-ink hover:bg-white"
              onClick={onInspect}
            >
              Inspect evidence
              <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              className="press h-10 pr-2! pl-2! text-sm font-semibold text-white underline underline-offset-4 hover:bg-white/10 hover:text-white"
              onClick={onExplain}
              disabled={explainDisabled}
            >
              Patient explanation
              <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>
      <p className="border-t border-white/10 px-4 py-1.5 text-right text-xs text-verdict-muted lg:px-6">
        Hackathon prototype · Synthetic data only · For clinician review
      </p>
    </section>
  );
}
