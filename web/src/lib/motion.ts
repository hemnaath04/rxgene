// Shared motion values (docs/DESIGN.md section 4). Full transform strings, no x/y/scale
// shorthands. Reduced motion: opacity only, 200 ms, no blur and no translate.
import type { HTMLMotionProps } from 'motion/react';

/** --ease-out: cubic-bezier(0.23, 1, 0.32, 1) */
export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** Gauge marker spring. Explanatory motion, so 600 ms is justified. */
export const MARKER_SPRING = { type: 'spring', duration: 0.6, bounce: 0 } as const;

/** Check-result sequence delays, in seconds. */
export const STEP = {
  inhibitorBadge: 0,
  currentValue: 0.1,
  marker: 0.2,
  strip: 0.3,
  stripStagger: 0.1,
} as const;

/**
 * Particle playback timing for the molecule stage (DESIGN.md section 4). One loop is 2.4s
 * linear, matching the `rx-flow` CSS keyframes. Travel is transform + opacity only.
 */
export const PARTICLE = {
  /** Seconds for one dot to cross a track; keep in sync with .flow-dot in index.css. */
  loopSeconds: 2.4,
  /** Evenly spaced rest positions (as % of track) when paused or before a check. */
  rest: ['8%', '28%', '48%', '68%', '88%'],
} as const;

type EnterExit = Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'>;

/**
 * Enter: opacity 0, translateY(12px), blur(4px) -> visible over 300 ms --ease-out.
 * Exit: opacity 0, translateY(-12px), blur(4px) over 150 ms.
 */
export function enterExit(reduce: boolean, delay = 0): EnterExit {
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.2, delay } },
      exit: { opacity: 0, transition: { duration: 0.2 } },
    };
  }
  return {
    initial: { opacity: 0, transform: 'translateY(12px)', filter: 'blur(4px)' },
    animate: {
      opacity: 1,
      transform: 'translateY(0px)',
      // Ends on 'none' so no filter stays behind: a leftover filter would stop the frosted
      // panels inside from blurring what's behind them.
      filter: 'none',
      transition: { duration: 0.3, ease: EASE_OUT, delay },
    },
    exit: {
      opacity: 0,
      transform: 'translateY(-12px)',
      filter: 'blur(4px)',
      transition: { duration: 0.15, ease: EASE_OUT },
    },
  };
}
