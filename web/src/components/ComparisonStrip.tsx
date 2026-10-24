import { Check, ChevronDown, Info } from 'lucide-react';
import { LEVEL, LevelIcon } from '@/components/AlertLevel';
import { cn } from '@/lib/utils';
import { actionWords, capitalize, speedOf } from '@/lib/verdict';
import type { DrugAssessment } from '@/engine/types';

type ComparisonStripProps = {
  /** The phenoconverted assessment (current medications included). */
  assessment: DrugAssessment;
  /** The same drug checked against the genotype alone (no medications), from the engine. */
  geneOnly: DrugAssessment | null;
};

/** "Normal. Standard dosing." from the engine's genotype-only result. */
function geneReportText(a: DrugAssessment | null): string {
  if (!a) return 'Not assessed.';
  const speed = speedOf(a.adjustedPhenotype);
  const action =
    a.alert === 'GREEN'
      ? 'Standard dosing.'
      : a.alert === 'GREY'
        ? 'Not assessed.'
        : `${capitalize(actionWords(a.alert, a.drug))}.`;
  return speed ? `${speed}. ${action}` : action;
}

/**
 * Collapsed by default under an accessible "Why this alert?" disclosure so it doesn't compete
 * with the main story (visual brief section 11). Shown only when phenoconverted is true.
 * Three equal cells; no product names and no severity ratings. Uses the real genotype-only
 * engine result via `geneOnly`.
 */
export function ComparisonStrip({ assessment: a, geneOnly }: ComparisonStripProps) {
  const now = speedOf(a.adjustedPhenotype);
  const inhibitor = a.inhibitor ? capitalize(a.inhibitor.drug) : 'Another medicine';

  const cells = [
    {
      title: 'Gene report alone',
      text: geneReportText(geneOnly),
      icon: <Check aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.5} />,
      strong: false,
    },
    {
      title: 'Typical interaction warning (illustrative)',
      text: `${inhibitor} may interact with ${a.drug}.`,
      icon: <Info aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.5} />,
      strong: false,
    },
    {
      title: 'RxGene',
      text: `${now ?? 'Changed'} right now → ${actionWords(a.alert, a.drug)}.`,
      icon: <LevelIcon level={a.alert} className="size-5" />,
      strong: true,
    },
  ];

  return (
    <details className="panel group rounded-2xl">
      <summary
        className="press flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-2.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden"
        aria-label="Why this alert? Compare what each source would show"
      >
        <span className="flex items-center gap-2">
          <Info aria-hidden="true" className="size-5 text-marine" strokeWidth={1.75} />
          Why this alert?
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 text-ink-muted transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          strokeWidth={2}
        />
      </summary>

      <div
        aria-label="What each source would show"
        className="grid grid-cols-1 gap-3 px-5 pt-1 pb-5 md:grid-cols-3"
      >
        {cells.map(cell => (
          <div
            key={cell.title}
            className={cn('flex flex-col gap-1 rounded-xl border border-ink/12 bg-panel-solid/70 p-4', cell.strong && 'border-2')}
            style={cell.strong ? { borderColor: LEVEL[a.alert].color } : undefined}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
              {cell.icon}
              {cell.title}
            </p>
            <p className={cn('text-base text-ink', cell.strong && 'font-semibold')}>{cell.text}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
