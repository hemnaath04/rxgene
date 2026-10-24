import type { CSSProperties } from 'react';
import { Pause, Pill, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PARTICLE } from '@/lib/motion';

/**
 * How the conceptual pathway reads for the current assessment. All states are illustrative
 * and never invent an engine decision. Animated metabolic throughput is restricted to the
 * supported opioids (codeine/tramadol); other supported drugs use the static 'guidance' state.
 * - 'idle'        : nothing checked yet, or pending — neutral, no animation, no play.
 * - 'notAssessed' : checked but no readable/supported output (uncomputed, not assessed,
 *                   missing/indeterminate gene) — static neutral, no play.
 * - 'guidance'    : a supported drug with a real result we do NOT animate as throughput
 *                   (atomoxetine, clopidogrel) — static, source-specific text, no play.
 * - 'normal'      : codeine/tramadol full capacity — green particles pass THROUGH the gate.
 * - 'reduced'     : codeine/tramadol constrained (genes / moderate effect), NOT phenoconverted
 *                   — sparse constrained travel, no full green throughput.
 * - 'inhibited'   : codeine/tramadol phenoconverted by a strong/moderate inhibitor — input
 *                   particles travel toward the gate and fade; channel blocked in coral.
 */
export type FlowState = 'idle' | 'notAssessed' | 'guidance' | 'normal' | 'reduced' | 'inhibited';

type MoleculeStageProps = {
  /** The drug entering the enzyme (capsule label at the input). */
  drug: string;
  /** The gene enzyme label, e.g. "CYP2D6". */
  gene: string;
  /** Plain-language output label below the pathway (from the assessment). */
  outputLabel: string;
  flow: FlowState;
  /** The inhibitor chip content, or null. The channel block appears for 'inhibited'. */
  inhibitor: { drug: string; strength: string } | null;
  /** Inherited enzyme-capability annotation, e.g. "Normal by genes". */
  capability: string;
  playing: boolean;
  onTogglePlay: () => void;
  reduce: boolean;
};

/**
 * Particles along a single track. `rest` positions are evenly spaced when paused; they animate
 * (transform + opacity only) when the wrapping track has data-play. `span` limits travel to a
 * fraction of the track so the inhibited flow stops at the gate.
 */
function FlowParticles({ count }: { count: number }) {
  return (
    <>
      {PARTICLE.rest.slice(0, count).map((rest, i) => (
        <span
          key={rest}
          className="flow-dot"
          style={{ '--i': i, '--rest': rest } as CSSProperties}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

/**
 * The connected biological pathway: capsule → particles that cross THROUGH the enzyme channel
 * → output, in one responsive grid. The enzyme sits in the center cell; a flow line and the
 * particles are overlaid across the full width so the path visibly passes through the protein.
 */
export function MoleculeStage({
  drug,
  gene,
  outputLabel,
  flow,
  inhibitor,
  capability,
  playing,
  onTogglePlay,
  reduce,
}: MoleculeStageProps) {
  const isNormal = flow === 'normal';
  const isReduced = flow === 'reduced';
  const isInhibited = flow === 'inhibited';
  const isAnimated = isNormal || isReduced || isInhibited;
  const isNeutral = flow === 'idle' || flow === 'notAssessed';
  // Playback only matters for animated opioid flows; disabled under reduced motion.
  const canPlay = isAnimated && !reduce;
  const animate = playing && canPlay;

  // Through-channel particles: green full throughput (normal), sparse constrained (reduced),
  // or input-only-to-gate then fade (inhibited). Output travel only exists when not blocked.
  const throughCount = isNormal ? 5 : isReduced ? 3 : isInhibited ? 3 : 0;
  const flowColor = isInhibited ? 'text-alert-red' : isReduced ? 'text-ink-muted' : 'text-[var(--color-flow)]';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Short capability annotation + inhibitor chip on one line */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 truncate text-sm text-ink-muted">
          Inherited capability · <span className="font-semibold text-ink">{gene} {capability}</span>
        </p>
        {inhibitor && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border-2 border-alert-red bg-panel-solid px-2.5 py-1">
            <Pill aria-hidden="true" className="size-4 text-alert-red" strokeWidth={2} />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-alert-red-text">{inhibitor.drug}</span>
              <span className="text-xs text-alert-red-text">{inhibitor.strength} inhibitor</span>
            </span>
          </div>
        )}
      </div>

      {/*
       * Pathway grid: capsule (fixed ~44px) · enzyme (flexible, substantial) — the flow line and
       * particles are overlaid across the whole grid so the path runs THROUGH the enzyme.
       * minmax(0,…) tracks prevent min-content overflow at narrow widths.
       */}
      <div className="relative grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        {/* Continuous flow line + particles, overlaid across the full pathway width */}
        <div className={cn('pointer-events-none absolute inset-x-11 top-1/2 -translate-y-1/2 sm:inset-x-12', flowColor)} aria-hidden="true">
          <div className="relative h-5">
            <span
              className={cn(
                'absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2',
                isInhibited ? 'border-ink/20' : 'border-ink/25',
                isReduced && 'border-dashed'
              )}
            />
            {/* Through-channel travel (normal/reduced cross fully; inhibited only to the gate). */}
            {isAnimated && (
              <div
                className="flow-track"
                data-play={animate || undefined}
                data-dim={isReduced || undefined}
                data-span={isInhibited ? 'gate' : undefined}
              >
                <FlowParticles count={throughCount} />
              </div>
            )}
            {/* Coral channel block for the inhibited case, centered on the enzyme gate. */}
            {isInhibited && (
              <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                <span className="h-7 w-1.5 rounded-full bg-alert-red shadow-[0_0_10px_2px_color-mix(in_oklch,var(--color-alert-red)_55%,transparent)]" />
              </span>
            )}
          </div>
        </div>

        {/* Drug capsule at the input */}
        <div className="z-10 flex flex-col items-center gap-0.5">
          <span className="flex size-10 items-center justify-center rounded-full border border-ink/15 bg-panel-solid">
            <Pill aria-hidden="true" className="size-5 text-marine" strokeWidth={1.75} />
          </span>
          <span className="text-center text-xs font-semibold text-ink">{drug}</span>
        </div>

        {/* Enzyme artwork — substantial but compact; the channel block overlay sits above. */}
        <div className="relative flex min-w-0 flex-col items-center">
          <div className="relative w-full max-w-[190px] min-w-0">
            <span className="enzyme-glow" data-active={(isNormal || isReduced) && animate} data-blocked={isInhibited} />
            <img
              src="/art/enzyme-gateway.webp"
              alt=""
              aria-hidden="true"
              draggable={false}
              className={cn(
                'relative mx-auto block h-auto w-full max-w-[190px] min-w-0 select-none object-contain',
                isNeutral ? 'opacity-55 saturate-50' : isInhibited ? 'opacity-95' : 'opacity-100'
              )}
            />
          </div>
          <span className="text-sm font-semibold text-ink">{gene} enzyme</span>
        </div>
      </div>

      {/* Output label BELOW the pathway + play control */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className={cn('min-w-0 text-sm font-medium', isInhibited ? 'text-alert-red-text' : 'text-ink')}>{outputLabel}</p>
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!canPlay}
          aria-label={playing ? 'Pause pathway animation' : 'Play pathway animation'}
          className={cn(
            'press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/20 bg-panel-solid px-2.5 py-1 text-sm font-semibold text-ink',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
        >
          {playing ? (
            <Pause aria-hidden="true" className="size-4" strokeWidth={2} />
          ) : (
            <Play aria-hidden="true" className="size-4" strokeWidth={2} />
          )}
          {playing ? 'Pause' : 'Play pathway'}
        </button>
      </div>
    </div>
  );
}
