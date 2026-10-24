import { Circle, CircleQuestionMark, Contrast, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Alert } from '@/engine/types';

/**
 * Every level carries an icon + a word + a color, so color is never the only cue
 * (DESIGN.md section 3). GREEN is neutral grey-blue, never green: green reads as "safe".
 */
export const LEVEL: Record<Alert, { word: string; icon: LucideIcon; color: string; textClass: string }> = {
  RED: { word: 'Avoid', icon: TriangleAlert, color: 'var(--color-alert-red)', textClass: 'text-alert-red-text' },
  YELLOW: { word: 'Dosing change', icon: Contrast, color: 'var(--color-alert-amber)', textClass: 'text-ink' },
  GREEN: { word: 'No supported alert', icon: Circle, color: 'var(--color-alert-neutral)', textClass: 'text-ink' },
  GREY: { word: 'Not assessed', icon: CircleQuestionMark, color: 'var(--color-alert-grey)', textClass: 'text-ink-muted' },
};

type LevelIconProps = { level: Alert; className?: string; strokeWidth?: number };

/** Decorative: the level word is always rendered next to it. */
export function LevelIcon({ level, className, strokeWidth = 2 }: LevelIconProps) {
  const Icon = LEVEL[level].icon;
  return <Icon aria-hidden="true" className={cn('shrink-0', className)} style={{ color: LEVEL[level].color }} strokeWidth={strokeWidth} />;
}

/** Icon + word chip, for lists and the evidence sheet. */
export function LevelChip({ level, className }: { level: Alert; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-sm font-semibold text-ink', className)}
      style={{ borderColor: LEVEL[level].color }}
    >
      <LevelIcon level={level} className="size-4" />
      {LEVEL[level].word}
    </span>
  );
}
