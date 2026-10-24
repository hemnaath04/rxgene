// R39: which numbered requirements (.kiro/specs/rxgene-engine/requirements.md) produced an
// alert. The engine doesn't emit them, so they are derived here from the assessment's own
// fields. Display only: nothing here changes a level or a recommendation.
import inhibitors from '@/data/inhibitors.json';
import { hasStar10Allele } from '@/engine/activityScore';
import type { DrugAssessment } from '@/engine/types';

/** Short titles for the evidence sheet. Wording follows requirements.md. */
export const REQUIREMENT_TITLES: Record<string, string> = {
  R1: 'Activity score = sum of the two allele activity values',
  R2: 'Duplication: allele value × copy number',
  R3: 'Activity score 0 → poor metabolizer',
  R4: 'Activity score above 0 and below 1.25 → intermediate metabolizer',
  R5: 'Activity score 1.25 to 2.25 → normal metabolizer',
  R6: 'Activity score above 2.25 → ultrarapid metabolizer',
  R7: 'Allele with no activity value → indeterminate, GREY',
  R8: 'Missing gene result → insufficient data, GREY',
  R10: 'Strong inhibitor → activity score 0 (codeine, tramadol)',
  R11: 'Moderate inhibitor → activity score × 0.5 (codeine, tramadol)',
  R12: 'Weak inhibitor → no adjustment, note only',
  R13: 'Several inhibitors → only the strongest is applied',
  R14: 'Adjusted activity score re-mapped to a phenotype',
  R15: 'Codeine uses the inhibitor adjustment rules',
  R16: 'Tramadol uses the inhibitor adjustment rules',
  R17: 'Atomoxetine + strong inhibitor → FDA label leads; CPIC poor-metabolizer text as supporting context',
  R18: 'Atomoxetine + moderate inhibitor → Not assessed (GREY), pharmacist review',
  R19: 'Genotype and adjusted phenotype shown side by side',
  R20: 'Ultrarapid + strong inhibitor → reduced confidence',
  R21: 'Already a poor metabolizer + inhibitor → alert stays, "adds no further effect"',
  R22: 'Adding a drug re-checks the current medications',
  R24: 'Codeine looked up by phenotype (from genotype or adjusted activity score)',
  R25: 'Tramadol looked up by phenotype (from genotype or adjusted activity score)',
  R26: 'Atomoxetine looked up by activity score (adults)',
  R27: 'Clopidogrel looked up by CYP2C19 phenotype (CVI ACS PCI)',
  R28: 'Omeprazole + clopidogrel → separate label-level note',
  R29: 'Alert level read from the curated alert_levels.json',
  R30: 'No curated alert level → GREY + data error (never GREEN)',
  R31: 'Standard dosing → GREEN, "No supported PGx alert (not the same as safe)"',
  R32: 'No recommendation, indeterminate or insufficient data → GREY',
  R33: 'Only the fixed GREEN disclaimer wording is allowed',
  R38: 'Guideline, strength, link and fetch date on every alert',
  R40: 'Current thresholds used; the 2019 atomoxetine convention differs',
  R41: 'Computed phenoconversion only for codeine and tramadol (atomoxetine per R17)',
  R42: 'No CYP2C19 phenoconversion',
  R43: 'Steady state: inhibitor onset and washout not modeled',
  R44: "Atomoxetine at activity score 1.0 with a *10 allele → CPIC '1.0 (*10 allele present)' titration row",
};

/** Prefix of the engine's "already a poor metabolizer" note (phenoconversion.ts). */
const ALREADY_PM_MARKER = ' adds no further effect';

const allInhibitors = new Set(
  [...inhibitors.CYP2D6.strong, ...inhibitors.CYP2D6.moderate, ...inhibitors.CYP2D6.weak].map(d => d.toLowerCase())
);

/** R3–R6 for a CYP2D6 activity score (same thresholds as the engine). */
function phenotypeRule(score: number): string {
  if (score === 0) return 'R3';
  if (score < 1.25) return 'R4';
  if (score <= 2.25) return 'R5';
  return 'R6';
}

/**
 * Requirement IDs behind one assessment, sorted by number.
 * @param meds the full medication list of the check, used only to show R13 (several inhibitors)
 */
export function requirementsFor(a: DrugAssessment, meds: string[] = []): string[] {
  const ids = new Set<string>();
  const drug = a.drug.toLowerCase();
  const isOpioid = drug === 'codeine' || drug === 'tramadol';
  const note = a.inhibitorNote ?? '';

  if (a.gene === 'CYP2D6') {
    if (!a.genotype) ids.add('R8');
    else if (a.genotypeActivityScore === null) ids.add('R7');
    else {
      ids.add('R1');
      if (/x\d/i.test(a.genotype)) ids.add('R2');
      ids.add(phenotypeRule(a.genotypeActivityScore));
    }
    ids.add('R19');

    if (a.inhibitor || note) ids.add('R43');
    if (note.startsWith('Weak')) ids.add('R12');
    if (note.includes(ALREADY_PM_MARKER)) ids.add('R21');
    if (a.adjustedPhenotype === 'not computed') ids.add('R18');

    if (a.phenoconverted && a.inhibitor) {
      if (isOpioid) {
        ids.add(a.inhibitor.strength === 'strong' ? 'R10' : 'R11');
        ids.add('R14');
        ids.add(drug === 'codeine' ? 'R15' : 'R16');
        if (a.adjustedActivityScore !== null) ids.add(phenotypeRule(a.adjustedActivityScore));
      } else if (drug === 'atomoxetine') {
        ids.add('R17');
      }
      ids.add('R41');
    }
    if (a.confidence === 'reduced') ids.add('R20');

    const inhibitorCount = meds.filter(m => m.toLowerCase() !== drug && allInhibitors.has(m.toLowerCase())).length;
    if (inhibitorCount > 1 && (a.inhibitor || note)) ids.add('R13');

    // Lookups by activity score (only when a score was used)
    if (a.adjustedActivityScore !== null) {
      if (drug === 'codeine') ids.add('R24');
      if (drug === 'tramadol') ids.add('R25');
      if (drug === 'atomoxetine') ids.add('R26');
    }
    if (drug === 'atomoxetine') ids.add('R40');
    // R44: atomoxetine at genotype AS exactly 1.0 with a *10 allele (no strong/moderate inhibitor).
    if (
      drug === 'atomoxetine' &&
      a.genotypeActivityScore !== null &&
      Math.abs(a.genotypeActivityScore - 1) < 1e-9 &&
      a.inhibitor?.strength !== 'strong' &&
      a.inhibitor?.strength !== 'moderate' &&
      hasStar10Allele(a.genotype)
    ) {
      ids.add('R44');
    }
  } else {
    if (a.genotype) ids.add('R27');
    if (a.labelNote) ids.add('R28');
    ids.add('R42');
  }

  if (a.triggeredBy.toLowerCase() !== drug) ids.add('R22');
  // R29: every alert level is read from the curated alert_levels.json.
  ids.add('R29');
  if (a.alert === 'GREEN') {
    ids.add('R31');
    ids.add('R33');
  }
  if (a.alert === 'GREY') {
    // R30 when a curated level was missing (data error); otherwise R32 (not assessed / indeterminate / insufficient).
    ids.add(a.dataError ? 'R30' : 'R32');
  }
  if (a.source.guideline && a.strength) ids.add('R38');

  return [...ids].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
}
