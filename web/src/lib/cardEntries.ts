// Turns engine output (local assessments and/or server CDS cards) into the cards the UI
// renders. No clinical logic here: every level comes from the engine, either via the
// CDS Hooks service or via checkOrder in the browser.
import type { CardVia } from '@/components/AlertCard';
import type { Alert, CdsCard, DrugAssessment } from '@/engine/types';
import { isCoveredDrug } from '@/lib/drugCatalog';
import { alertFromCard } from '@/lib/cdsClient';

export type CardEntry =
  | {
      kind: 'assessment';
      key: string;
      assessment: DrugAssessment;
      via: CardVia;
      /** Level from the server card (EHR mode). */
      alert?: Alert;
      cdsSummary?: string;
      mismatch?: string;
    }
  | { kind: 'cds-only'; key: string; card: CdsCard; alert: Alert; mismatch: string }
  | { kind: 'uncovered'; key: string; via: CardVia };

/** The drug a card is about; a newer check of the same drug replaces the older card. */
export const entryDrug = (entry: CardEntry) => entry.key.split('#')[0];

/** Add a GREY "no guideline" card when the added drug isn't covered and got no assessment. */
function withUncovered(drug: string, entries: CardEntry[], assessments: DrugAssessment[], via: CardVia): CardEntry[] {
  if (!isCoveredDrug(drug) && !assessments.some(a => a.drug === drug)) {
    return [{ kind: 'uncovered', key: drug, via }, ...entries];
  }
  return entries;
}

/** Local mode, or the fallback after a failed CDS call. */
export function localEntries(drug: string, assessments: DrugAssessment[], via: CardVia): CardEntry[] {
  const entries = assessments.map((assessment): CardEntry => ({
    kind: 'assessment',
    key: assessment.drug,
    assessment,
    via
  }));
  return withUncovered(drug, entries, assessments, via);
}

/**
 * EHR mode: the server's cards decide the level shown; the local assessments (same engine,
 * same inputs, same order) only fill in the side-by-side phenotype detail. Any disagreement
 * in count, drug or level is flagged as a mismatch.
 */
export function cdsEntries(drug: string, cards: CdsCard[], assessments: DrugAssessment[]): CardEntry[] {
  const entries: CardEntry[] = [];
  const count = Math.max(cards.length, assessments.length);

  for (let i = 0; i < count; i++) {
    const card = cards[i];
    const a = assessments[i];

    if (card && a) {
      const alert = alertFromCard(card);
      let mismatch: string | undefined;
      if (alert !== a.alert) {
        mismatch = `the CDS Hooks service returned ${alert} but the local engine returned ${a.alert}.`;
      } else if (!card.summary.toLowerCase().includes(a.drug.toLowerCase())) {
        mismatch = `the CDS Hooks card ("${card.summary}") is not about ${a.drug}.`;
      }
      entries.push({ kind: 'assessment', key: a.drug, assessment: a, via: 'cds-hooks', alert, cdsSummary: card.summary, mismatch });
    } else if (card) {
      entries.push({
        kind: 'cds-only',
        key: `${drug}#cds-${i}`,
        card,
        alert: alertFromCard(card),
        mismatch: 'the CDS Hooks service returned a card the local engine has no assessment for.'
      });
    } else if (a) {
      entries.push({
        kind: 'assessment',
        key: a.drug,
        assessment: a,
        via: 'local',
        mismatch: `the CDS Hooks service returned no card for ${a.drug}; this level is from the local engine.`
      });
    }
  }

  return withUncovered(drug, entries, assessments, 'cds-hooks');
}
