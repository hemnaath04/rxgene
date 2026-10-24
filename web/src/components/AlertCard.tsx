import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LevelChip } from '@/components/AlertLevel';
import { cn } from '@/lib/utils';
import { formatScore, speedOf, type Verdict } from '@/lib/verdict';

/** Where a card's alert level came from. */
export type CardVia = 'cds-hooks' | 'local-fallback' | 'local';

export const VIA_LABEL: Record<CardVia, string> = {
  'cds-hooks': 'via CDS Hooks',
  'local-fallback': 'local fallback',
  local: 'local',
};

export function ViaBadge({ via, className }: { via: CardVia; className?: string }) {
  return (
    <Badge variant="outline" className={cn('h-6 px-2.5 text-xs font-medium', className)}>
      {VIA_LABEL[via]}
    </Badge>
  );
}

export function MismatchWarning({ text, className }: { text: string; className?: string }) {
  return (
    <p role="alert" className={cn('text-base font-semibold', className)}>
      Mismatch: {text} Do not act on this card; ask a pharmacist.
    </p>
  );
}

type AlertCardProps = {
  verdict: Verdict;
  selected: boolean;
  onSelect: () => void;
};

/** "Normal (activity score 2.0)" / "Not computed (pharmacist review)" */
function phenotypeLine(phenotype: string, score: number | null, scoreLabel?: string): string {
  if (phenotype === 'not computed') return 'Not computed (pharmacist review)';
  // R17: the FDA-label phenotype description, with "n/a" instead of a computed score.
  if (scoreLabel) return `${phenotype} (activity score ${scoreLabel})`;
  const speed = speedOf(phenotype);
  const s = formatScore(score);
  const base = speed ?? 'Not assessed';
  return s !== null ? `${base} (activity score ${s})` : base;
}

/**
 * One alert in the evidence sheet's "Alerts in this check" list. Level = icon + word +
 * color. R19: by-genes and with-medications phenotypes always side by side.
 */
export function AlertCard({ verdict: v, selected, onSelect }: AlertCardProps) {
  const a = v.assessment;
  return (
    <article
      aria-label={`${v.drug}: ${v.headline}`}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-panel-solid p-4',
        selected ? 'border-ink/60 ring-2 ring-ink/15' : 'border-ink/15'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <LevelChip level={v.level} />
        <ViaBadge via={v.via} />
      </div>
      {v.prefix && <p className="text-sm text-ink-muted">{v.prefix}</p>}
      <p className="text-base font-semibold break-words text-ink">{v.headline}</p>
      {/* R31: GREEN is the genotype result only, not an overall medication clearance. */}
      {v.qualifier && <p className="text-sm text-ink">{v.qualifier}</p>}
      {v.mismatch && <MismatchWarning text={v.mismatch} className="text-alert-red-text" />}
      {/* R7/R8/R18: the fixed GREY text on the card itself. */}
      {v.level === 'GREY' && <p className="text-sm text-ink">{v.sentence}</p>}
      {/* R28: the label interaction text on the card itself. */}
      {v.labelNote && (
        <p className="rounded-lg border border-ink/25 bg-ink/5 px-3 py-2 text-sm font-medium text-ink">{v.labelNote}</p>
      )}

      {a && (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-muted">By genes</dt>
            <dd className="text-ink">{phenotypeLine(a.genotypePhenotype, a.genotypeActivityScore)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">With current medications</dt>
            <dd className="text-ink">
              {phenotypeLine(a.adjustedPhenotype, a.adjustedActivityScore, a.adjustedActivityScoreLabel)}
            </dd>
          </div>
        </dl>
      )}

      <Button
        variant={selected ? 'secondary' : 'outline'}
        size="sm"
        className="press w-fit"
        onClick={onSelect}
        aria-pressed={selected}
      >
        {selected ? 'Showing evidence below' : `Show evidence for ${v.drug}`}
      </Button>
    </article>
  );
}
