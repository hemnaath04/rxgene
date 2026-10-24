import { motion, useReducedMotion } from 'motion/react';
import { Check, Info } from 'lucide-react';
import { LEVEL, LevelIcon } from '@/components/AlertLevel';
import { cn } from '@/lib/utils';
import { enterExit, STEP } from '@/lib/motion';
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
 * Shown only when phenoconverted is true (DESIGN.md section 3). Three equal cells; no
 * product names and no severity ratings.
 */
export function ComparisonStrip({ assessment: a, geneOnly }: ComparisonStripProps) {
  const reduce = !!useReducedMotion();
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
    <section aria-label="What each source would show" className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {cells.map((cell, i) => (
        <motion.div
          key={cell.title}
          {...enterExit(reduce, STEP.strip + i * STEP.stripStagger)}
          className={cn('panel flex flex-col gap-1 rounded-2xl p-5', cell.strong && 'border-2')}
          style={cell.strong ? { borderColor: LEVEL[a.alert].color } : undefined}
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
            {cell.icon}
            {cell.title}
          </p>
          <p className={cn('text-base text-ink', cell.strong && 'font-semibold')}>{cell.text}</p>
        </motion.div>
      ))}
    </section>
  );
}
