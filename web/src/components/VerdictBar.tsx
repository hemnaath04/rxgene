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
 * Compact horizontal deep-petrol verdict strip (visual brief section 10):
 * icon + headline left, full clinical rationale middle, evidence/explanation right.
 *
 * All upstream clinical content renders here in order: the FDA label recommendation first
 * (R17), the differing-guidance-context flag (R17), the card's label interaction note (R28),
 * the plain sentence, the verbatim CPIC quote, the CPIC supporting-context role (R17), the
 * genotype (unconverted) recommendation (R20), every note, then source · population and the
 * source links/versions (R17). Styling is compact but no clinical content is dropped; special
 * cases may make the band taller, which is correct. Wraps naturally on smaller viewports.
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
            <h2 id="verdict-heading" className="text-[26px]/[30px] font-bold tracking-[-0.02em] text-balance break-words lg:text-[30px]/[34px]">
              {v.headline}
            </h2>
            {/* R31: GREEN is the genotype result only, not an overall medication clearance. */}
            {v.qualifier && <p className="text-sm font-medium text-verdict-muted">{v.qualifier}</p>}
          </div>
        </div>

        {/* Middle: rationale + full clinical content + source. Compact styling, but no
            clinical content is dropped — special cases (FDA label first, differing-context flag,
            label note, genotype vs converted recommendation, source links) may make the band
            taller, which is correct. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 break-words lg:border-l lg:border-white/20 lg:pl-6">
          {v.mismatch && <MismatchWarning text={v.mismatch} className="rounded-lg bg-white/10 px-3 py-1.5 text-white" />}
          {/* R17: FDA label recommendation applies directly; show it first. */}
          {v.labelRecommendation && (
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <p className="text-sm font-semibold text-white">FDA label (applies directly)</p>
              <p className="text-[15px] text-white/90">{v.labelRecommendation}</p>
            </div>
          )}
          {/* R17: the two guidance contexts are not interchangeable — visible bordered block. */}
          {v.discrepancyFlag && (
            <p className="rounded-lg border border-white/30 px-3 py-2 text-sm text-white">{v.discrepancyFlag}</p>
          )}
          {/* R28: the label interaction text on the card itself, separate from the genotype result. */}
          {v.labelNote && (
            <p className="flex items-start gap-2 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-[15px] font-medium text-white">
              <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
              <span>{v.labelNote}</span>
            </p>
          )}
          <p className="text-[15px]/6">{v.sentence}</p>
          {v.quote && <blockquote className="border-l-2 border-white/30 pl-3 text-sm text-white/90">{v.quote}</blockquote>}
          {/* R17: CPIC is supporting genotype-based context only. */}
          {v.cpicRole && <p className="text-xs text-verdict-muted">{v.cpicRole}</p>}
          {/* R20: show the genotype (unconverted) recommendation alongside the converted one. */}
          {v.genotypeRecommendation && (
            <blockquote className="border-l-2 border-white/30 pl-3 text-sm text-white/90">
              <span className="font-semibold">Genotype recommendation: </span>
              {v.genotypeRecommendation}
            </blockquote>
          )}
          {v.notes.map(note => (
            <p key={note} className="text-sm text-white/85">
              {note}
            </p>
          ))}
          {(v.source || v.population) && (
            <p className="text-xs text-verdict-muted">{[v.source, v.population].filter(Boolean).join(' · ')}</p>
          )}
          {/* R17: FDA label + CPIC source links and versions stay visible. */}
          {v.sourceLinks.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-verdict-muted">
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
