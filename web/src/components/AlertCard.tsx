import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GREEN_ALERT_TEXT } from '@/engine/cdsCard';
import type { Alert, CdsCard, DrugAssessment } from '@/engine/types';

// UI wording (docs/PLAN-v3.md "UI language"). Technical terms will move to the EvidenceDrawer.
const PHENOCONVERSION_TEXT = "Another medicine changed how this patient's genes work.";
const NOT_ASSESSED_TEXT = 'Not assessed. No supported PGx alert can be given.';

const BADGE_VARIANT: Record<Alert, 'destructive' | 'secondary' | 'outline' | 'ghost'> = {
  RED: 'destructive',
  YELLOW: 'secondary',
  GREEN: 'outline',
  GREY: 'ghost',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Phenotype -> "Clears this drug: ..." scale (Slow / Reduced / Normal / Fast). */
function clearsThisDrug(phenotype: string): string | null {
  if (phenotype.startsWith('Poor')) return 'Slow';
  if (phenotype.startsWith('Intermediate') || phenotype.startsWith('Likely Intermediate')) return 'Reduced';
  if (phenotype.startsWith('Normal')) return 'Normal';
  if (phenotype.startsWith('Ultrarapid') || phenotype.startsWith('Rapid')) return 'Fast';
  return null;
}

/** Plain-language headline. Derived only from the engine's alert level and its CPIC text. */
function headline(a: DrugAssessment): string {
  const drug = capitalize(a.drug);
  const rec = a.recommendation.toLowerCase();

  switch (a.alert) {
    case 'RED':
      if (rec.includes('diminished analgesia')) return `Avoid ${a.drug}: it likely won't relieve this patient's pain`;
      if (rec.includes('serious toxicity')) return `Avoid ${a.drug}: risk of serious toxicity for this patient`;
      return `Avoid ${a.drug} for this patient (CPIC guideline)`;
    case 'YELLOW':
      return `${drug}: the guideline gives a modified dosing plan for this patient`;
    case 'GREEN':
      return `${drug}: ${GREEN_ALERT_TEXT}`;
    case 'GREY':
    default:
      if (a.adjustedPhenotype === 'not computed') return `${drug}: pharmacist review (not computed)`;
      if (a.genotypePhenotype.startsWith('Insufficient data')) return `${drug}: not assessed (insufficient data)`;
      if (a.genotypePhenotype.startsWith('Indeterminate')) return `${drug}: not assessed (gene result can't be interpreted)`;
      return `${drug}: not assessed`;
  }
}

function formatScore(score: number | null): string | null {
  return score !== null && Number.isFinite(score) ? score.toFixed(2) : null;
}

/** Where a card's alert level came from. */
export type CardVia = 'cds-hooks' | 'local-fallback' | 'local';

const VIA_LABEL: Record<CardVia, string> = {
  'cds-hooks': 'via CDS Hooks',
  'local-fallback': 'local fallback',
  local: 'local',
};

function ViaBadge({ via }: { via: CardVia }) {
  return <Badge variant="outline">{VIA_LABEL[via]}</Badge>;
}

function MismatchWarning({ text }: { text: string }) {
  return (
    <p role="alert" className="font-semibold text-destructive">
      Mismatch: {text} Do not act on this card; ask a pharmacist.
    </p>
  );
}

type AlertCardProps = {
  assessment: DrugAssessment;
  via?: CardVia;
  /** Alert level from the server card (EHR mode). Defaults to the assessment's level. */
  alert?: Alert;
  /** Server card summary, used as the title when the levels disagree. */
  cdsSummary?: string;
  /** Set when the server card and the local engine disagree. */
  mismatch?: string;
};

type PhenotypeColumnProps = {
  title: string;
  phenotype: string;
  activityScore: number | null;
};

function PhenotypeColumn({ title, phenotype, activityScore }: PhenotypeColumnProps) {
  const notComputed = phenotype === 'not computed';
  const speed = notComputed ? null : clearsThisDrug(phenotype);
  const score = formatScore(activityScore);

  return (
    <div>
      <dt>{title}</dt>
      <dd>{notComputed ? 'Not computed (pharmacist review)' : phenotype}</dd>
      {speed && <dd>Clears this drug: {speed}</dd>}
      {score && <dd>Activity score {score}</dd>}
    </div>
  );
}

export function AlertCard({ assessment: a, via = 'local', alert, cdsSummary, mismatch }: AlertCardProps) {
  // In EHR mode the level comes from the server card; the local assessment fills in detail.
  const shown = alert ?? a.alert;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Badge variant={BADGE_VARIANT[shown]}>{shown}</Badge> {mismatch && cdsSummary ? cdsSummary : headline(a)}
        </CardTitle>
        <CardDescription>
          <ViaBadge via={via} /> Gene result: {a.gene} {a.genotype ?? 'none on file'}
          {a.triggeredBy !== a.drug && ` · Re-checked because ${a.triggeredBy} was added`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mismatch && <MismatchWarning text={mismatch} />}
        {/* R19: genotype phenotype and adjusted phenotype always side by side */}
        <dl className="grid grid-cols-2 gap-4">
          <PhenotypeColumn
            title="By genes (genotype phenotype)"
            phenotype={a.genotypePhenotype}
            activityScore={a.genotypeActivityScore}
          />
          <PhenotypeColumn
            title="Right now, with current medicines (adjusted phenotype)"
            phenotype={a.adjustedPhenotype}
            activityScore={a.adjustedActivityScore}
          />
        </dl>

        {a.phenoconverted && <p>{PHENOCONVERSION_TEXT}</p>}

        {a.inhibitor && (
          <p>
            Inhibitor: {a.inhibitor.drug} ({a.inhibitor.strength} CYP2D6 inhibitor, FDA)
          </p>
        )}

        {a.confidence === 'reduced' && (
          <p>
            <strong>Reduced confidence:</strong> ultrarapid metabolizers may not phenoconvert to the
            same extent (CPIC 2023).
          </p>
        )}

        {a.inhibitorNote && <p>Note: {a.inhibitorNote}</p>}
        {a.labelNote && <p>{a.labelNote}</p>}

        <h3>CPIC recommendation</h3>
        <blockquote>{a.recommendation}</blockquote>
        {a.strength && <p>Strength: {a.strength}</p>}
        {a.source.guideline && (
          <p>
            Source:{' '}
            {a.source.url ? (
              <a href={a.source.url} target="_blank" rel="noreferrer">
                CPIC {a.source.guideline}
              </a>
            ) : (
              `CPIC ${a.source.guideline}`
            )}
            {a.source.fetched && ` · fetched ${a.source.fetched}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** GREY card for a drug RxGene has no CPIC guideline for (checkOrder returns no assessment). */
export function NotCoveredCard({ drug, via = 'local' }: { drug: string; via?: CardVia }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Badge variant={BADGE_VARIANT.GREY}>GREY</Badge> {capitalize(drug)}: not assessed
        </CardTitle>
        <CardDescription>
          <ViaBadge via={via} /> RxGene has no CPIC guideline for this drug.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>{NOT_ASSESSED_TEXT}</p>
      </CardContent>
    </Card>
  );
}

/**
 * A server card the local engine has no matching assessment for. Shown as returned,
 * always with the mismatch warning.
 */
export function CdsOnlyCard({ card, alert, mismatch }: { card: CdsCard; alert: Alert; mismatch: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Badge variant={BADGE_VARIANT[alert]}>{alert}</Badge> {card.summary}
        </CardTitle>
        <CardDescription>
          <ViaBadge via="cds-hooks" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MismatchWarning text={mismatch} />
        <p className="whitespace-pre-wrap">{card.detail}</p>
      </CardContent>
    </Card>
  );
}
