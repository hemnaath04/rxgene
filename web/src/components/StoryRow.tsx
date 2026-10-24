import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Info, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { MoleculeStage } from '@/components/MoleculeStage';
import { cn } from '@/lib/utils';
import { enterExit, STEP } from '@/lib/motion';
import { flowStateFor, outputLabelFor } from '@/lib/moleculeFlow';
import { alreadySlowInhibitor, byGenesText, capitalize, formatScore, speedOf, type Gene } from '@/lib/verdict';
import type { Alert, DrugAssessment } from '@/engine/types';

type StoryRowProps = {
  patientName: string;
  /** The drug in focus: the top alert's drug, or the prescription before a check. */
  drug: string;
  gene: Gene;
  genotype: string | null;
  /** Phenotype from the genotype alone. */
  genotypePhenotype: string;
  /** null before a check, and for drugs with no CPIC guideline. */
  assessment: DrugAssessment | null;
  /** null = not checked yet. */
  level: Alert | null;
  pending: boolean;
  /** Pathway playback, owned by App so it resets with the patient/result. */
  playing: boolean;
  onTogglePlay: () => void;
};

/** Numbered column heading with a subtle guide line, aligned across the three stages. */
function StepLabel({ n, title, id }: { n: string; title: string; id: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-full border border-ink/25 bg-panel-solid/70 text-sm font-semibold text-marine">
        {n}
      </span>
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <span aria-hidden="true" className="h-px flex-1 bg-ink/15" />
    </div>
  );
}

function captionFor(a: DrugAssessment | null, checked: boolean, patientName: string, gene: Gene, drug: string): string {
  if (!checked) return `Press Check prescription to see how ${patientName}'s current medications affect ${drug}.`;
  if (!a) return `RxGene has no CPIC guideline for ${drug}.`;
  const alreadySlow = alreadySlowInhibitor(a);
  if (alreadySlow) return `${capitalize(alreadySlow)} adds no further effect: ${patientName} was already slow by genes.`;
  const inh = a.inhibitor;
  if (inh && a.adjustedPhenotype === 'not computed') {
    return `${capitalize(inh.drug)} is a moderate inhibitor. Its effect on ${a.drug} isn't computed: pharmacist review.`;
  }
  if (inh?.strength === 'strong') return `${capitalize(inh.drug)} reduces ${gene} activity. ${patientName}'s genes are unchanged.`;
  if (inh?.strength === 'moderate') return `${capitalize(inh.drug)} partly reduces ${gene} activity. ${patientName}'s genes are unchanged.`;
  if (a.inhibitorNote?.startsWith('Weak')) return `A weak ${gene} inhibitor is on the list. It doesn't change the activity score.`;
  if (gene === 'CYP2C19') return `RxGene doesn't model ${gene} inhibition.${a.labelNote ? ' See the label note below.' : ''}`;
  return `No ${gene} inhibitor on the medication list.`;
}

const DISPLAY_COLOR: Record<Alert, string> = {
  RED: 'text-alert-red',
  YELLOW: 'text-ink',
  GREEN: 'text-ink',
  GREY: 'text-ink-muted',
};

const UNDERLINE: Record<Alert, string> = {
  RED: 'var(--color-alert-red)',
  YELLOW: 'var(--color-alert-amber)',
  GREEN: 'var(--color-alert-neutral)',
  GREY: 'var(--color-alert-grey)',
};

/**
 * Sculptural DNA helix (production webp). Muted when the gene result is missing or
 * indeterminate so an unreadable baseline never looks like a confirmed normal result.
 */
function HelixArt({ muted, className }: { muted: boolean; className?: string }) {
  return (
    <img
      src="/art/dna-helix.webp"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('select-none object-contain', muted && 'opacity-40 saturate-50', className)}
    />
  );
}

/**
 * One open connected biological canvas: 01 Genetic baseline · 02 Medication effect ·
 * 03 Current response, roughly 27% / 47% / 26% on desktop. Stacks logically on mobile.
 * All props/contracts preserved; outputLabel() and captionFor() logic unchanged.
 */
export function StoryRow({
  patientName,
  drug,
  gene,
  genotype,
  genotypePhenotype,
  assessment: a,
  level,
  pending,
  playing,
  onTogglePlay,
}: StoryRowProps) {
  const reduce = !!useReducedMotion();
  const checked = level !== null;
  const nowSpeed = a ? speedOf(a.adjustedPhenotype) : null;
  const flowSpeed = checked ? nowSpeed : speedOf(genotypePhenotype);
  const inhibitor = a?.inhibitor ?? null;
  const notComputed = a?.adjustedPhenotype === 'not computed';

  // The genetic baseline is unreadable when there's no genotype or no mappable phenotype.
  const baselineSpeed = speedOf(genotypePhenotype);
  const baselineMuted = genotype === null || baselineSpeed === null;

  // Conceptual pathway state (pure helper, UI-only — never invents an engine decision).
  // Pending suppresses any flow so stale cards can't animate a fake result.
  const flow = flowStateFor(a, checked, pending);

  // Atomoxetine with a strong inhibitor: the baseline engine returns a numeric adjusted score
  // (tracked P13 mismatch), but CPIC/FDA give PM-equivalent dosing, not a computed AS. Suppress
  // the numeric adjusted-score arrow and the computed current marker for that case; show neutral
  // dosing guidance instead. Baseline genes stay known; Evidence exposes the raw engine output.
  const atomoxetineStrongGuidance =
    a?.drug === 'atomoxetine' && a.inhibitor?.strength === 'strong' && a.alert !== 'GREY';

  // Column 03 value: plain-language speed, or why there is none.
  let value: string | null = null;
  if (checked) {
    if (atomoxetineStrongGuidance) value = 'Dosing guidance';
    else if (nowSpeed) value = nowSpeed;
    else if (a?.adjustedPhenotype === 'not computed') value = 'Not computed';
    else value = 'Not assessed';
  }
  const isWord = value !== null && value === nowSpeed;

  const g = a ? formatScore(a.genotypeActivityScore) : null;
  const adj = a ? formatScore(a.adjustedActivityScore) : null;
  const scoreChanged = g !== null && adj !== null && g !== adj;

  let scoreSub: string | null = null;
  if (a && a.gene === 'CYP2D6' && g !== null) {
    if (a.phenoconverted) scoreSub = 'Rule-adjusted';
    else if (alreadySlowInhibitor(a)) scoreSub = 'No further change';
    else if (a.adjustedPhenotype === 'not computed') scoreSub = 'Pharmacist review';
    else scoreSub = 'Same as genes';
  }

  return (
    <section
      aria-label="How current medications change this assessment"
      className="panel rounded-2xl p-4 sm:p-5"
    >
      {/* Numbered headings, aligned across stages at the three-column widths. */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,27fr)_minmax(0,47fr)_minmax(0,26fr)]">
        <StepLabel n="01" title="Genetic baseline" id="story-01" />
        <StepLabel n="02" title="Medication effect" id="story-02" />
        <StepLabel n="03" title="Current response" id="story-03" />
      </div>

      <div className="mt-0 grid grid-cols-1 gap-5 lg:mt-3 lg:grid-cols-[minmax(0,27fr)_minmax(0,47fr)_minmax(0,26fr)] lg:items-center lg:gap-6">
        {/* 01 Genetic baseline — labels beside the helix on desktop */}
        <section aria-labelledby="story-01-m" className="flex min-w-0 flex-col gap-2">
          <div className="lg:hidden">
            <StepLabel n="01" title="Genetic baseline" id="story-01-m" />
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <HelixArt muted={baselineMuted} className="h-[185px] w-auto max-w-[115px] shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-base font-semibold break-words text-ink">
                {gene} · {genotype ?? 'no result on file'}
              </p>
              <p className="text-base break-words text-ink">{byGenesText(genotypePhenotype)}</p>
              <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-muted">
                <Lock aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
                Genes unchanged
              </p>
            </div>
          </div>
        </section>

        {/* 02 Medication effect */}
        <section aria-labelledby="story-02-m" className="flex min-w-0 flex-col gap-2 lg:border-x lg:border-ink/10 lg:px-5">
          <div className="lg:hidden">
            <StepLabel n="02" title="Medication effect" id="story-02-m" />
          </div>

          {!inhibitor && a?.labelNote && (
            <div className="flex w-fit items-center gap-2 rounded-lg border border-ink/25 bg-panel-solid px-2.5 py-1 text-sm text-ink">
              <Info aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
              Label interaction note (not computed)
            </div>
          )}

          <MoleculeStage
            drug={capitalize(drug)}
            gene={gene}
            outputLabel={outputLabelFor(drug, flow, flowSpeed, notComputed)}
            flow={flow}
            inhibitor={inhibitor ? { drug: capitalize(inhibitor.drug), strength: capitalize(inhibitor.strength) } : null}
            capability={byGenesText(genotypePhenotype)}
            playing={playing}
            onTogglePlay={onTogglePlay}
            reduce={reduce}
          />
        </section>

        {/* 03 Current response */}
        <section aria-labelledby="story-03-m" className="flex min-w-0 flex-col gap-1.5">
          <div className="lg:hidden">
            <StepLabel n="03" title="Current response" id="story-03-m" />
          </div>
          <p className="text-sm text-ink-muted">With current medications</p>

          <div className="relative min-h-14">
            <AnimatePresence mode="popLayout" initial={false}>
              {pending && !checked ? (
                <motion.div key="pending" {...enterExit(reduce)}>
                  <Skeleton className="h-14 w-full max-w-48 rounded-lg" />
                  <span className="sr-only">Checking…</span>
                </motion.div>
              ) : value ? (
                <motion.p
                  key={`value-${value}`}
                  {...enterExit(reduce, STEP.currentValue)}
                  className={cn(
                    'font-bold tracking-[-0.02em] break-words hyphens-auto',
                    isWord
                      ? 'text-[clamp(36px,5vw,54px)]/[1.02]'
                      : 'text-[clamp(24px,3vw,34px)]/[1.1]',
                    level ? DISPLAY_COLOR[level] : 'text-ink'
                  )}
                >
                  {value}
                </motion.p>
              ) : (
                <motion.p key="idle" {...enterExit(reduce)} className="text-[clamp(24px,2.6vw,30px)]/[1.1] font-bold text-ink-muted">
                  Not checked yet
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {level && <span aria-hidden="true" className="h-1 w-full max-w-48 rounded-full" style={{ backgroundColor: UNDERLINE[level] }} />}

          {atomoxetineStrongGuidance ? (
            <>
              {g !== null && (
                <p className="text-base text-ink">
                  By genes · activity score <span className="font-semibold">{g}</span>
                </p>
              )}
              <p className="text-sm text-ink-muted">PM-equivalent dosing (FDA label) · see evidence</p>
            </>
          ) : (
            <>
              {a && a.gene === 'CYP2D6' && g !== null && (
                <p className="text-base text-ink">
                  Activity score{' '}
                  <span className={cn('font-semibold', scoreChanged && level === 'RED' ? 'text-alert-red-text' : 'text-ink')}>
                    {g} → {adj ?? 'not computed'}
                  </span>
                </p>
              )}
              {a && a.gene === 'CYP2C19' && <p className="text-base text-ink">Gene result only (no activity score)</p>}
              {scoreSub && <p className="text-sm text-ink-muted">{scoreSub}</p>}
            </>
          )}
          {a?.confidence === 'reduced' && (
            <span className="w-fit rounded-lg border-2 border-dashed border-ink/50 px-2.5 py-0.5 text-sm font-semibold text-ink">
              Reduced confidence
            </span>
          )}
        </section>
      </div>

      {/* Compact full-width footer: the one explanatory sentence + the illustrative caption. */}
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-ink/10 pt-3">
        <p className="min-w-0 flex-1 text-sm break-words text-ink">{captionFor(a, checked, patientName, gene, drug)}</p>
        <p className="shrink-0 text-xs text-ink-muted">Conceptual pathway · particle flow is illustrative</p>
      </div>
    </section>
  );
}
