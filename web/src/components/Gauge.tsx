import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { MARKER_SPRING, STEP } from '@/lib/motion';
import type { ClearsSpeed } from '@/engine/templates';
import type { Alert } from '@/engine/types';

const STOPS: ClearsSpeed[] = ['Slow', 'Reduced', 'Normal', 'Fast'];

/** Marker wrappers are as wide as the track, so these percentages are of the track. */
const POSITION: Record<ClearsSpeed, string> = {
  Slow: '0%',
  Reduced: '33.333%',
  Normal: '66.667%',
  Fast: '100%',
};

const tx = (speed: ClearsSpeed) => `translateX(${POSITION[speed]})`;

const MARKER_COLOR: Record<Alert, string> = {
  RED: 'var(--color-alert-red)',
  YELLOW: 'var(--color-alert-amber)',
  GREEN: 'var(--color-alert-neutral)',
  GREY: 'var(--color-alert-grey)',
};

type GaugeProps = {
  /** ○ hollow marker: phenotype from the genotype alone. null = no marker. */
  byGenes: ClearsSpeed | null;
  /** ● solid marker: adjusted phenotype with current medications. null = no marker. */
  now: ClearsSpeed | null;
  /** Level of the shown alert; colors the ● marker. */
  level: Alert | null;
  /** Ultrarapid + strong inhibitor: ● drawn as a dashed ring. */
  reducedConfidence?: boolean;
  /** Shown under the track when the ● can't be placed (e.g. "not computed"). */
  nowNote?: string | null;
};

function ByGenesDot() {
  return (
    <span className="absolute top-1/2 left-0 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-ink bg-panel-solid" />
  );
}

function NowDot({ color, dashed }: { color: string; dashed: boolean }) {
  // The ring offset (box-shadow in the panel color) keeps ○ visible when both sit on one stop.
  return dashed ? (
    <span
      className="absolute top-1/2 left-0 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-dashed"
      style={{
        borderColor: color,
        backgroundColor: `color-mix(in oklch, ${color} 18%, var(--color-panel-solid))`,
        boxShadow: '0 0 0 3px var(--color-panel-solid)',
      }}
    />
  ) : (
    <span
      className="absolute top-1/2 left-0 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ backgroundColor: color, boxShadow: '0 0 0 3px var(--color-panel-solid)' }}
    />
  );
}

/**
 * Single Slow / Reduced / Normal / Fast scale with ○ "by genes" and ● "right now".
 * When a check completes, ● starts on ○ and springs to its stop (DESIGN.md section 4).
 * Only transform is animated, never left/width. Reduced motion: markers cross-fade.
 */
export function Gauge({ byGenes, now, level, reducedConfidence = false, nowNote }: GaugeProps) {
  const reduce = !!useReducedMotion();
  const color = level ? MARKER_COLOR[level] : 'var(--color-ink)';
  const empty = !byGenes && !now;

  const description = empty
    ? 'Clears this drug: not assessed. No gene result we can read.'
    : `Clears this drug. By genes: ${byGenes ?? 'not assessed'}. With current medications: ${
        now ?? (nowNote ? 'not computed' : 'not checked yet')
      }.`;

  return (
    <section aria-labelledby="gauge-heading" className="panel overflow-hidden rounded-2xl px-6 py-3 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="gauge-heading" className="text-base font-semibold text-ink">
          Clears this drug
        </h2>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted" aria-hidden="true">
          <li className="flex items-center gap-2">
            <span
              className={cn('inline-block size-3 rounded-full', reducedConfidence && 'border-2 border-dashed bg-transparent!')}
              style={{ backgroundColor: color, borderColor: color }}
            />
            with medications
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block size-3.5 rounded-full border-2 border-ink" />
            by genes
          </li>
        </ul>
      </div>

      <div role="img" aria-label={description} className="mx-4 mt-3">
        <div className={cn('relative h-7', empty && 'opacity-40')}>
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ink/25" />
          {/* Plain ticks at every stop; only ● and ○ are dots (no decorative third marker). */}
          {STOPS.map(stop => (
            <span
              key={stop}
              className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/35"
              style={{ left: POSITION[stop] }}
            />
          ))}

          {reduce ? (
            <AnimatePresence initial={false}>
              {byGenes && (
                <motion.div
                  key={`genes-${byGenes}`}
                  className="pointer-events-none absolute inset-0"
                  style={{ transform: tx(byGenes) }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ByGenesDot />
                </motion.div>
              )}
              {now && (
                <motion.div
                  key={`now-${now}-${reducedConfidence}`}
                  className="pointer-events-none absolute inset-0"
                  style={{ transform: tx(now) }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <NowDot color={color} dashed={reducedConfidence} />
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {byGenes && (
                  <motion.div
                    key="genes"
                    className="pointer-events-none absolute inset-0"
                    initial={{ transform: tx(byGenes), opacity: 0 }}
                    animate={{ transform: tx(byGenes), opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ transform: MARKER_SPRING, opacity: { duration: 0.15 } }}
                  >
                    <ByGenesDot />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {now && (
                  <motion.div
                    key="now"
                    className="pointer-events-none absolute inset-0"
                    // Starts on ○, then springs apart to its own stop.
                    initial={{ transform: tx(byGenes ?? now), opacity: 0 }}
                    animate={{ transform: tx(now), opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{
                      transform: { ...MARKER_SPRING, delay: STEP.marker },
                      opacity: { duration: 0.15, delay: STEP.marker },
                    }}
                  >
                    <NowDot color={color} dashed={reducedConfidence} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <div className={cn('relative mt-1 h-5', empty && 'opacity-40')} aria-hidden="true">
          {STOPS.map(stop => (
            <span
              key={stop}
              className={cn(
                'absolute top-0 -translate-x-1/2 text-sm text-ink-muted',
                (stop === byGenes || stop === now) && 'font-semibold text-ink'
              )}
              style={{ left: POSITION[stop] }}
            >
              {stop}
            </span>
          ))}
        </div>
      </div>

      {empty && <p className="mt-1 text-center text-sm font-medium text-ink-muted">No gene result we can read · Not assessed</p>}
      {!empty && !now && nowNote && <p className="mt-1 text-center text-sm text-ink-muted">{nowNote}</p>}
    </section>
  );
}
