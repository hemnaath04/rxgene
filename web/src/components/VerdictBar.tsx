import { ArrowRight, ArrowUpRight, Info } from 'lucide-react';
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
 * Dark verdict bar (DESIGN.md sections 1 and 3): icon + headline, the plain sentence and the
 * guideline line, then the actions. The source badge shows where the level came from.
 * App animates it in (after the comparison strip) and out.
 */
export function VerdictBar({ verdict: v, moreCount, onInspect, onMore, onExplain, explainDisabled }: VerdictBarProps) {
  return (
    <section
      aria-labelledby="verdict-heading"
      className="rounded-2xl bg-verdict text-white shadow-[0_12px_40px_-12px_oklch(0.2_0.05_240/0.5)]"
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-8 lg:p-7">
        <div className="flex min-w-0 items-start gap-4 lg:w-[34%] lg:shrink-0">
          <LevelIcon level={v.level} className="mt-1 size-10 sm:size-12" strokeWidth={2} />
          <div className="flex min-w-0 flex-col gap-1">
            {v.prefix && <p className="text-base text-verdict-muted">{v.prefix}</p>}
            <p className="text-base text-verdict-muted">Prescription review</p>
            <h2
              id="verdict-heading"
              className="text-[28px]/[32px] font-bold tracking-[-0.02em] text-balance break-words sm:text-[40px]/[44px]"
            >
              {v.headline}
            </h2>
            {/* R31: GREEN is the genotype result only, not an overall medication clearance. */}
            {v.qualifier && <p className="text-lg font-medium text-verdict-muted">{v.qualifier}</p>}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 break-words lg:border-l lg:border-white/20 lg:pl-8">
          {v.mismatch && <MismatchWarning text={v.mismatch} className="rounded-lg bg-white/10 px-3 py-2 text-white" />}
          {/* R17: FDA label recommendation applies directly; show it first. */}
          {v.labelRecommendation && (
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <p className="text-sm font-semibold text-white">FDA label (applies directly)</p>
              <p className="text-base text-white/90">{v.labelRecommendation}</p>
            </div>
          )}
          {/* R17: the two guidance contexts are not interchangeable. */}
          {v.discrepancyFlag && (
            <p className="rounded-lg border border-white/30 px-3 py-2 text-base text-white">{v.discrepancyFlag}</p>
          )}
          {/* R28: the label interaction text on the card itself, separate from the genotype result. */}
          {v.labelNote && (
            <p className="flex items-start gap-2 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-base font-medium text-white">
              <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
              <span>{v.labelNote}</span>
            </p>
          )}
          <p className="text-lg/7">{v.sentence}</p>
          {v.quote && <blockquote className="border-l-2 border-white/30 pl-3 text-base text-white/90">{v.quote}</blockquote>}
          {/* R17: CPIC is supporting genotype-based context only. */}
          {v.cpicRole && <p className="text-sm text-verdict-muted">{v.cpicRole}</p>}
          {/* R20: show the genotype (unconverted) recommendation alongside the converted one. */}
          {v.genotypeRecommendation && (
            <blockquote className="border-l-2 border-white/30 pl-3 text-base text-white/90">
              <span className="font-semibold">Genotype recommendation: </span>
              {v.genotypeRecommendation}
            </blockquote>
          )}
          {v.notes.map(note => (
            <p key={note} className="text-base text-white/90">
              {note}
            </p>
          ))}
          {(v.source || v.population) && (
            <p className="text-sm text-verdict-muted">{[v.source, v.population].filter(Boolean).join(' · ')}</p>
          )}
          {/* R17: FDA label + CPIC source links and versions stay visible. */}
          {v.sourceLinks.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-verdict-muted">
              {v.sourceLinks.map(link => (
                <li key={link.label}>
                  {link.label}
                  {link.url && (
                    <>
                      {': '}
                      <a className="break-all text-white underline underline-offset-2" href={link.url} target="_blank" rel="noreferrer">
                        {link.url}
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
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
            className="press h-12 rounded-lg bg-[oklch(0.93_0.04_220)] pr-[18px]! pl-5! text-base font-semibold text-ink hover:bg-white"
            onClick={onInspect}
          >
            Inspect evidence
            <ArrowUpRight aria-hidden="true" className="size-5" strokeWidth={2} />
          </Button>
          <Button
            variant="ghost"
            className="press h-10 pr-1.5! pl-2! text-base font-semibold text-white underline underline-offset-4 hover:bg-white/10 hover:text-white"
            onClick={onExplain}
            disabled={explainDisabled}
          >
            Patient explanation
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
