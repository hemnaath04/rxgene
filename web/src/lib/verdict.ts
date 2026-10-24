// Plain-language view of the engine's output for the story row, gauge, strip and verdict bar
// (docs/PLAN-v3.md "UI language", docs/DESIGN.md section 3). Wording only: every level and
// recommendation comes from the engine. Never says "safe" except in "not the same as safe".
import type { CardVia } from '@/components/AlertCard';
import { getActivityScore } from '@/engine/activityScore';
import { drugToGene } from '@/engine/data';
import { activityScoreToPhenotype, cyp2c19DiplotypeToPhenotype } from '@/engine/phenotype';
import { clearsThisDrug, type ClearsSpeed } from '@/engine/templates';
import type { Alert, DrugAssessment, Patient } from '@/engine/types';
import { entryDrug, type CardEntry } from '@/lib/cardEntries';

export type Gene = DrugAssessment['gene'];

/** RED > YELLOW > GREY > GREEN (DESIGN.md section 3, "More than one assessment"). */
const SEVERITY: Record<Alert, number> = { RED: 0, YELLOW: 1, GREY: 2, GREEN: 3 };

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The level a card shows: the server's in EHR mode, otherwise the engine's. */
export function entryAlert(entry: CardEntry): Alert {
  if (entry.kind === 'assessment') return entry.alert ?? entry.assessment.alert;
  if (entry.kind === 'cds-only') return entry.alert;
  return 'GREY';
}

/** Stable sort by severity; ties keep the engine's order (added drug first). */
export function sortBySeverity(entries: CardEntry[]): CardEntry[] {
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => SEVERITY[entryAlert(a.entry)] - SEVERITY[entryAlert(b.entry)] || a.i - b.i)
    .map(x => x.entry);
}

/** Poor -> Slow, Intermediate -> Reduced, Normal -> Normal, Ultrarapid -> Fast. Else null. */
export function speedOf(phenotype: string | null | undefined): ClearsSpeed | null {
  if (!phenotype || phenotype === 'not computed') return null;
  return clearsThisDrug(phenotype);
}

/** "2.0", "0", "1.5", "0.25" */
export function formatScore(score: number | null): string | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score === 0) return '0';
  return Number.isInteger(score) ? score.toFixed(1) : String(Number(score.toFixed(2)));
}

/** Gene the drug is checked against; for uncovered drugs, the gene on file. */
export function geneFor(drug: string, patient: Patient): Gene {
  const gene = drugToGene[drug.toLowerCase()];
  if (gene) return gene;
  return !patient.cyp2d6 && patient.cyp2c19 ? 'CYP2C19' : 'CYP2D6';
}

/** Phenotype from the genotype alone (no medicines considered), as the engine maps it. */
export function genotypePhenotypeFor(patient: Patient, gene: Gene): string {
  if (gene === 'CYP2C19') {
    return patient.cyp2c19 ? cyp2c19DiplotypeToPhenotype(patient.cyp2c19) : 'Insufficient data (no CYP2C19 result)';
  }
  const result = getActivityScore(patient.cyp2d6);
  if (result.activityScore === null) return result.phenotype;
  return activityScoreToPhenotype(result.activityScore);
}

/** "Normal by genes" / "Gene result can't be read" / "No gene result on file" */
export function byGenesText(phenotype: string | null): string {
  const speed = speedOf(phenotype);
  if (speed) return `${speed} by genes`;
  if (phenotype?.startsWith('Insufficient')) return 'No gene result on file';
  return "Gene result can't be read";
}

const GUIDELINE_SHORT: Record<string, string> = {
  'CYP2D6, OPRM1, COMT, and Opioids': 'CPIC Opioids · 2021',
  'CYP2D6 and Atomoxetine': 'CPIC Atomoxetine · 2019',
  'CYP2C19 and Clopidogrel': 'CPIC Clopidogrel · 2022',
};

/** "CPIC Opioids · 2021 · Strong" */
export function sourceLine(a: DrugAssessment): string | null {
  if (!a.source.guideline) return null;
  const name = GUIDELINE_SHORT[a.source.guideline] ?? `CPIC ${a.source.guideline}`;
  return a.strength ? `${name} · ${a.strength}` : name;
}

/** Prefix of the engine's "already a poor metabolizer" note (phenoconversion.ts). */
const ALREADY_PM_MARKER = ' adds no further effect';

/** The inhibitor named in the "already a poor metabolizer" note, if that's the note. */
export function alreadySlowInhibitor(a: DrugAssessment): string | null {
  const note = a.inhibitorNote ?? '';
  const at = note.indexOf(ALREADY_PM_MARKER);
  return at > 0 ? note.slice(0, at) : null;
}

/** Short action for the comparison strip and the RxGene cell: "avoid codeine". */
export function actionWords(level: Alert, drug: string): string {
  switch (level) {
    case 'RED':
      return `avoid ${drug}`;
    case 'YELLOW':
      return drug === 'atomoxetine' ? `adjust ${drug} dosing` : `review ${drug} dosing`;
    case 'GREEN':
      return 'no supported alert';
    case 'GREY':
    default:
      return 'refer to pharmacist';
  }
}

export type Verdict = {
  key: string;
  drug: string;
  level: Alert;
  via: CardVia;
  assessment: DrugAssessment | null;
  /** "Adding fluoxetine affects a current medication:" (reverse case) */
  prefix: string | null;
  /** "Avoid codeine." only when RED. YELLOW never says Avoid. */
  headline: string;
  /** "(not the same as safe)" for GREEN */
  qualifier: string | null;
  sentence: string;
  /** CPIC text verbatim, shown in the bar when the plain sentence doesn't carry it. */
  quote: string | null;
  /** R17: FDA label recommendation, shown FIRST for atomoxetine + strong inhibitor. */
  labelRecommendation: string | null;
  /** R17: "Different guidance contexts" flag. */
  discrepancyFlag: string | null;
  /** R20: the genotype (e.g. ultrarapid) recommendation, shown alongside the converted one. */
  genotypeRecommendation: string | null;
  notes: string[];
  source: string | null;
  mismatch: string | null;
};

function headlineFor(level: Alert, drug: string): string {
  switch (level) {
    case 'RED':
      return `Avoid ${drug}.`;
    case 'YELLOW':
      return drug === 'atomoxetine' ? 'Adjust atomoxetine dosing.' : `Review ${drug} dosing.`;
    case 'GREEN':
      return 'No supported alert';
    case 'GREY':
    default:
      return 'Not assessed: refer to pharmacist';
  }
}

function sentenceFor(a: DrugAssessment): { sentence: string; quote: string | null } {
  const Drug = capitalize(a.drug);
  const rec = a.recommendation.toLowerCase();

  switch (a.alert) {
    case 'RED':
      if (rec.includes('diminished analgesia')) {
        return { sentence: `${Drug} likely won't relieve pain for this patient. Consider an alternative.`, quote: null };
      }
      if (rec.includes('toxicity')) {
        return { sentence: `${Drug} could cause serious side effects for this patient. Consider an alternative.`, quote: null };
      }
      return { sentence: a.recommendation, quote: null };
    case 'YELLOW':
      if (a.drug === 'atomoxetine') {
        return { sentence: 'Atomoxetine may build up in this patient. CPIC gives a titration plan:', quote: a.recommendation };
      }
      if (a.drug === 'codeine' || a.drug === 'tramadol') {
        return { sentence: `${Drug} may relieve pain less well for this patient. CPIC says:`, quote: a.recommendation };
      }
      return { sentence: 'CPIC gives a modified plan:', quote: a.recommendation };
    case 'GREEN':
      return {
        sentence: `RxGene has no guideline-backed flag for ${a.drug} with this gene result and medication list.`,
        quote: null,
      };
    case 'GREY':
    default: {
      if (a.adjustedPhenotype === 'not computed') {
        const inh = a.inhibitor ? capitalize(a.inhibitor.drug) : 'A moderate inhibitor';
        return {
          sentence: `${inh} is a moderate ${a.gene} inhibitor. Its effect on ${a.drug} isn't computed.`,
          quote: null,
        };
      }
      if (a.genotypePhenotype.startsWith('Insufficient')) {
        return { sentence: `No ${a.gene} result on file, so ${a.drug} can't be checked.`, quote: null };
      }
      if (a.genotypePhenotype.startsWith('Indeterminate')) {
        return { sentence: `No gene result we can read for ${a.drug}.`, quote: null };
      }
      if (rec.startsWith('no recommendation')) {
        return { sentence: 'CPIC gives no recommendation for this gene result.', quote: null };
      }
      return { sentence: `${Drug} can't be checked against this gene result.`, quote: null };
    }
  }
}

function notesFor(a: DrugAssessment): string[] {
  const notes: string[] = [];
  const alreadySlow = alreadySlowInhibitor(a);
  if (alreadySlow) {
    notes.push(`${capitalize(alreadySlow)} adds no further effect: this patient was already slow by genes.`);
  } else if (a.inhibitorNote?.startsWith('Weak')) {
    notes.push('A weak CYP2D6 inhibitor is on the list. It doesn’t change the activity score (CPIC adjusts strong and moderate only).');
  } else if (a.inhibitorNote) {
    notes.push(a.inhibitorNote);
  }
  if (a.confidence === 'reduced') notes.push('Ultrarapid metabolizers may not fully convert (CPIC 2023).');
  if (a.labelNote) notes.push(a.labelNote);
  return notes;
}

export function toVerdict(entry: CardEntry): Verdict {
  const drug = entryDrug(entry);
  const level = entryAlert(entry);

  if (entry.kind === 'assessment') {
    const a = entry.assessment;
    const { sentence, quote } = sentenceFor(a);
    const mismatch = entry.mismatch ?? null;
    return {
      key: entry.key,
      drug,
      level,
      via: entry.via,
      assessment: a,
      prefix: a.triggeredBy !== a.drug ? `Adding ${a.triggeredBy} affects a current medication:` : null,
      // On a mismatch the server's own summary is shown, with the warning.
      headline: mismatch && entry.cdsSummary ? entry.cdsSummary : headlineFor(level, drug),
      qualifier: level === 'GREEN' && !mismatch ? '(not the same as safe)' : null,
      sentence,
      quote,
      labelRecommendation: a.labelRecommendation ?? null,
      discrepancyFlag: a.discrepancyFlag ?? null,
      genotypeRecommendation: a.genotypeRecommendation ?? null,
      notes: notesFor(a),
      source: sourceLine(a),
      mismatch,
    };
  }

  if (entry.kind === 'cds-only') {
    return {
      key: entry.key,
      drug,
      level,
      via: 'cds-hooks',
      assessment: null,
      prefix: null,
      headline: entry.card.summary,
      qualifier: null,
      sentence: 'Returned by the CDS Hooks service only.',
      quote: null,
      labelRecommendation: null,
      discrepancyFlag: null,
      genotypeRecommendation: null,
      notes: [],
      source: entry.card.source.label ? `CPIC ${entry.card.source.label}` : null,
      mismatch: entry.mismatch,
    };
  }

  return {
    key: entry.key,
    drug,
    level,
    via: entry.via,
    assessment: null,
    prefix: null,
    headline: headlineFor('GREY', drug),
    qualifier: null,
    sentence: `RxGene has no CPIC guideline for ${drug}.`,
    quote: null,
    labelRecommendation: null,
    discrepancyFlag: null,
    genotypeRecommendation: null,
    notes: [],
    source: null,
    mismatch: null,
  };
}
