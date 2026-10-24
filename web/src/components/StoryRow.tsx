import type { CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Info, Lock, Pill } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { enterExit, STEP } from '@/lib/motion';
import { alreadySlowInhibitor, byGenesText, capitalize, formatScore, speedOf, type Gene } from '@/lib/verdict';
import type { ClearsSpeed } from '@/engine/templates';
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
};

function StepLabel({ n, title, id }: { n: string; title: string; id: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-full border border-ink/20 bg-panel-solid text-base font-semibold text-ink">
        {n}
      </span>
      <h2 id={id} className="text-xl font-semibold text-ink">
        {title}
      </h2>
      <span aria-hidden="true" className="h-px flex-1 bg-ink/15" />
    </div>
  );
}

/** Simple DNA helix (inline SVG art, kept inside its column). */
function HelixArt({ className }: { className?: string }) {
  const rungs = [10, 40, 60, 90, 110, 140, 160, 190];
  return (
    <svg viewBox="0 0 80 200" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="helix-a" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.62 0.12 225)" />
          <stop offset="100%" stopColor="oklch(0.55 0.10 240)" />
        </linearGradient>
      </defs>
      {rungs.map(y => {
        const half = Math.abs(Math.cos((y / 50) * Math.PI)) * 18;
        return (
          <line
            key={y}
            x1={40 - half}
            x2={40 + half}
            y1={y}
            y2={y}
            stroke="oklch(0.72 0.13 165)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        );
      })}
      <path
        d="M22 0 C22 25 58 25 58 50 S22 75 22 100 S58 125 58 150 S22 175 22 200"
        fill="none"
        stroke="url(#helix-a)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M58 0 C58 25 22 25 22 50 S58 75 58 100 S22 125 22 150 S58 175 58 200"
        fill="none"
        stroke="oklch(0.70 0.10 215)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

/** Enzyme blob (inline SVG art). */
function EnzymeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="enzyme-fill" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="oklch(0.92 0.05 220)" />
          <stop offset="100%" stopColor="oklch(0.72 0.09 230)" />
        </radialGradient>
      </defs>
      <path
        d="M18 46 C8 26 26 8 48 12 C62 2 88 6 98 20 C114 26 116 50 104 62 C100 80 76 88 60 80 C44 90 18 84 16 68 C6 62 8 52 18 46 Z"
        fill="url(#enzyme-fill)"
        stroke="oklch(0.55 0.09 235)"
        strokeWidth="2"
      />
      {/* Active-site notch on the left, where the drug enters */}
      <path d="M16 38 Q30 45 16 52" fill="none" stroke="oklch(0.55 0.09 235)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const REST = ['10%', '30%', '50%', '70%', '90%'];

/** Five dots along a track. CSS animation; static under prefers-reduced-motion. */
function FlowTrack({ dim = false, dashed = false, className }: { dim?: boolean; dashed?: boolean; className?: string }) {
  return (
    <div className={cn('flow-track', className)} data-dim={dim} aria-hidden="true">
      <span className="flow-line" data-dashed={dashed} />
      {REST.map((rest, i) => (
        <span key={rest} className="flow-dot" style={{ '--i': i, '--rest': rest } as CSSProperties} />
      ))}
    </div>
  );
}

/** What the enzyme makes or does with this drug, in plain words (directional only). */
function outputLabel(drug: string, speed: ClearsSpeed | null): string {
  const lower = speed === 'Slow' || speed === 'Reduced';
  switch (drug) {
    case 'codeine':
      return lower ? 'Reduced morphine formation' : speed === 'Fast' ? 'More morphine formation' : 'Morphine formation';
    case 'tramadol':
      return lower ? 'Less active painkiller formed' : speed === 'Fast' ? 'More active painkiller formed' : 'Active painkiller formed';
    case 'atomoxetine':
      return lower ? 'Slower clearance: drug builds up' : speed === 'Fast' ? 'Faster clearance' : 'Normal clearance';
    case 'clopidogrel':
      return lower ? 'Less activation to the active form' : 'Activation to the active form';
    default:
      return speed ? 'Drug processing' : 'Effect not assessed';
  }
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
  if (gene === 'CYP2C19') return `RxGene doesn't model ${gene} inhibition.${a.labelNote ? ' The label interaction above is not computed.' : ''}`;
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

/** Three columns: 01 Genetic baseline · 02 Medication effect · 03 Current response. */
export function StoryRow({ patientName, drug, gene, genotype, genotypePhenotype, assessment: a, level, pending }: StoryRowProps) {
  const reduce = !!useReducedMotion();
  const checked = level !== null;
  const nowSpeed = a ? speedOf(a.adjustedPhenotype) : null;
  const flowSpeed = checked ? nowSpeed : speedOf(genotypePhenotype);
  const inhibitor = a?.inhibitor ?? null;

  // Column 03 value: plain-language speed, or why there is none.
  let value: string | null = null;
  if (checked) {
    if (nowSpeed) value = nowSpeed;
    else if (a?.adjustedPhenotype === 'not computed') value = 'Not computed';
    else value = 'Not assessed';
  }
  const isWord = value !== null && value === nowSpeed;

  const g = a ? formatScore(a.genotypeActivityScore) : null;
  const adj = a ? (a.adjustedActivityScoreLabel ?? formatScore(a.adjustedActivityScore)) : null;
  const scoreChanged = g !== null && adj !== null && g !== adj;

  let scoreSub: string | null = null;
  if (a && a.gene === 'CYP2D6' && g !== null) {
    if (a.adjustedActivityScoreLabel) scoreSub = 'Label-based (FDA), no score computed';
    else if (a.phenoconverted) scoreSub = 'Rule-adjusted';
    else if (alreadySlowInhibitor(a)) scoreSub = 'No further change';
    else if (a.adjustedPhenotype === 'not computed') scoreSub = 'Pharmacist review';
    else scoreSub = 'Same as genes';
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3">
      {/* 01 Genetic baseline */}
      <section aria-labelledby="story-01" className="panel flex min-w-0 flex-col gap-4 rounded-2xl p-5 sm:p-6">
        <StepLabel n="01" title="Genetic baseline" id="story-01" />
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xl font-semibold break-words text-ink">
              {gene} · {genotype ?? 'no result on file'}
            </p>
            <p className="text-base text-ink">{byGenesText(genotypePhenotype)}</p>
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
              <Lock aria-hidden="true" className="size-4" strokeWidth={1.5} />
              Genes unchanged
            </p>
          </div>
          <HelixArt className="h-40 w-16 shrink-0" />
        </div>
      </section>

      {/* 02 Medication effect */}
      <section aria-labelledby="story-02" className="panel flex min-w-0 flex-col gap-3 rounded-2xl p-5 sm:p-6">
        <StepLabel n="02" title="Medication effect" id="story-02" />

        <div className="relative flex min-h-12 justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {inhibitor && (
              <motion.div
                key={`inh-${inhibitor.drug}-${inhibitor.strength}`}
                {...enterExit(reduce, STEP.inhibitorBadge)}
                className="flex items-center gap-2 rounded-lg border-2 border-alert-red bg-panel-solid px-3 py-1.5"
              >
                <Pill aria-hidden="true" className="size-5 text-alert-red" strokeWidth={2} />
                <span className="flex flex-col leading-tight">
                  <span className="text-base font-semibold text-alert-red-text">{capitalize(inhibitor.drug)}</span>
                  <span className="text-sm text-alert-red-text">{capitalize(inhibitor.strength)} inhibitor</span>
                </span>
              </motion.div>
            )}
            {!inhibitor && a?.labelNote && (
              <motion.p
                key="label-note"
                {...enterExit(reduce, STEP.inhibitorBadge)}
                className="flex items-start gap-2 rounded-lg border border-ink/25 bg-panel-solid px-3 py-1.5 text-sm font-medium text-ink"
              >
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                {/* R28: the label text itself, not a generic badge. */}
                <span>{a.labelNote}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Conceptual pathway: drug → particles → enzyme (⊣ when inhibited) → output */}
        <div className="flex items-center gap-2" aria-hidden="true">
          <div className="flex w-16 shrink-0 flex-col items-center gap-1">
            <Pill className="size-7 text-ink" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-ink">{capitalize(drug)}</span>
          </div>
          <FlowTrack className="flex-1 text-[oklch(0.62_0.13_165)]" />
          <span
            className={cn('h-6 w-1 shrink-0 rounded-full bg-alert-red transition-opacity duration-150', !inhibitor && 'opacity-0')}
          />
          <div className="flex shrink-0 flex-col items-center">
            <EnzymeArt className="h-16 w-20" />
            <span className="text-sm font-semibold text-ink">{gene} enzyme</span>
          </div>
          <FlowTrack className="w-14 shrink-0 text-ink-muted" dim={!!inhibitor} dashed={!!inhibitor} />
        </div>
        <p className="text-right text-sm font-medium text-ink">{outputLabel(drug, flowSpeed)}</p>

        <p className="text-base text-ink">{captionFor(a, checked, patientName, gene, drug)}</p>
        <p className="text-sm text-ink-muted">Conceptual pathway · particle flow is illustrative</p>
      </section>

      {/* 03 Current response */}
      <section aria-labelledby="story-03" className="panel flex min-w-0 flex-col gap-3 rounded-2xl p-5 sm:p-6">
        <StepLabel n="03" title="Current response" id="story-03" />
        <p className="text-base text-ink">With current medications</p>

        <div className="relative min-h-24">
          <AnimatePresence mode="popLayout" initial={false}>
            {pending && !checked ? (
              <motion.div key="pending" {...enterExit(reduce)}>
                <Skeleton className="h-24 w-56 rounded-lg" />
                <span className="sr-only">Checking…</span>
              </motion.div>
            ) : value ? (
              <motion.p
                key={`value-${value}`}
                {...enterExit(reduce, STEP.currentValue)}
                className={cn(
                  'font-extrabold tracking-[-0.02em] break-words',
                  // 96/1 per DESIGN.md; 64px on phones so "Reduced" fits a 390px screen;
                  // 72px in the 1024–1279px three-column layout so "Reduced" fits.
                  isWord
                    ? 'text-[64px]/none sm:text-[96px]/none lg:text-[72px]/none xl:text-[96px]/none'
                    : 'text-[36px]/[1.1] sm:text-[48px]/[1.1]',
                  level ? DISPLAY_COLOR[level] : 'text-ink'
                )}
              >
                {value}
              </motion.p>
            ) : (
              <motion.p key="idle" {...enterExit(reduce)} className="text-[40px]/[1.1] font-bold text-ink-muted">
                Not checked yet
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {level && <span aria-hidden="true" className="h-1 w-full rounded-full" style={{ backgroundColor: UNDERLINE[level] }} />}

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
        {a?.confidence === 'reduced' && (
          <span className="w-fit rounded-lg border-2 border-dashed border-ink/50 px-2.5 py-0.5 text-sm font-semibold text-ink">
            Reduced confidence
          </span>
        )}
      </section>
    </div>
  );
}
