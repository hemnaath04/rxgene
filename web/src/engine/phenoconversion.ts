// Phenoconversion: inhibitor detection and activity score adjustment
// Rules from .kiro/steering/clinical-rules.md

import { cyp2d6Inhibitors } from './data.js';
import type { InhibitorStrength } from './types.js';
import { activityScoreToPhenotype } from './phenotype.js';
import { ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE, umReducedConfidenceNote } from './fixedTexts.js';

export type InhibitorResult = {
  drug: string;
  strength: InhibitorStrength;
} | null;

export type PhenoconversionResult = {
  inhibitor: InhibitorResult;
  adjustedActivityScore: number | null;
  adjustedPhenotype: string;
  phenoconverted: boolean | null;
  confidence: 'standard' | 'reduced';
  inhibitorNote?: string;
};

/**
 * Find the strongest CYP2D6 inhibitor in a medication list
 * If multiple inhibitors, returns the strongest (strong > moderate > weak)
 */
export function findStrongestInhibitor(medications: string[]): InhibitorResult {
  const medLower = medications.map(m => m.toLowerCase());

  // Check for strong inhibitors first
  for (const med of medLower) {
    if (cyp2d6Inhibitors.strong.has(med)) {
      return { drug: medications[medLower.indexOf(med)], strength: 'strong' };
    }
  }

  // Check for moderate inhibitors
  for (const med of medLower) {
    if (cyp2d6Inhibitors.moderate.has(med)) {
      return { drug: medications[medLower.indexOf(med)], strength: 'moderate' };
    }
  }

  // Check for weak inhibitors
  for (const med of medLower) {
    if (cyp2d6Inhibitors.weak.has(med)) {
      return { drug: medications[medLower.indexOf(med)], strength: 'weak' };
    }
  }

  return null;
}

/**
 * Apply phenoconversion rules for CYP2D6
 * Strong inhibitor -> AS × 0
 * Moderate inhibitor -> AS × 0.5
 * Weak inhibitor -> no change, but add a note
 * 
 * Special cases:
 * - Already PM (AS = 0) + any inhibitor: note "adds no further effect"
 * - UM + strong inhibitor: reduced confidence
 * 
 * @param drug The drug being assessed (codeine, tramadol, or atomoxetine)
 * @param genotypeAS Original activity score from genotype
 * @param genotypePhenotype Original phenotype from genotype
 * @param medications All medications (current + added)
 */
export function applyPhenoconversion(
  drug: string,
  genotypeAS: number | null,
  genotypePhenotype: string,
  medications: string[]
): PhenoconversionResult {
  // Default: no phenoconversion
  const defaultResult: PhenoconversionResult = {
    inhibitor: null,
    adjustedActivityScore: genotypeAS,
    adjustedPhenotype: genotypePhenotype,
    phenoconverted: false,
    confidence: 'standard'
  };

  // If no valid activity score, can't compute phenoconversion
  if (genotypeAS === null) {
    return {
      ...defaultResult,
      phenoconverted: null
    };
  }

  const inhibitor = findStrongestInhibitor(medications);
  
  if (!inhibitor) {
    return defaultResult;
  }

  // R21: already PM by genotype (AS = 0) + ANY inhibitor (strong, moderate or weak).
  // The drug-level alert still fires because the lookup uses AS 0.
  // This is checked BEFORE R18 and R17, so a genotype-PM patient always gets the drug-level
  // alert with the R21 note, regardless of inhibitor strength.
  if (genotypeAS === 0) {
    return {
      // Weak inhibitors don't populate the main inhibitor field (same convention as below)
      inhibitor: inhibitor.strength === 'weak' ? null : inhibitor,
      adjustedActivityScore: 0,
      adjustedPhenotype: 'Poor Metabolizer',
      phenoconverted: false,
      confidence: 'standard',
      inhibitorNote: `${inhibitor.drug} adds no further effect: already a poor metabolizer by genotype. The drug-level alert still applies.`
    };
  }

  // Atomoxetine special case: moderate inhibitor = not computed (R18)
  // Only applies when the genotype is NOT already a poor metabolizer (R21 handled above)
  if (drug === 'atomoxetine' && inhibitor.strength === 'moderate') {
    return {
      inhibitor,
      adjustedActivityScore: null,
      adjustedPhenotype: 'not computed',
      phenoconverted: null,
      confidence: 'standard'
    };
  }

  // R17: atomoxetine + strong inhibitor. FDA label-based handling, NOT the opioid ×0 rule.
  // No multiplier: the adjusted score is reported as null ("n/a") and the adjusted phenotype
  // is the fixed FDA-label description. The recommendation/alert lookup uses AS 0 (done in
  // checkOrder).
  if (drug === 'atomoxetine' && inhibitor.strength === 'strong') {
    const isUM = genotypeAS > 2.25;
    return {
      inhibitor,
      adjustedActivityScore: null,
      adjustedPhenotype: ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE,
      phenoconverted: genotypePhenotype !== 'Poor Metabolizer',
      confidence: isUM ? 'reduced' : 'standard'
    };
  }

  // Weak inhibitors: no adjustment, just a note
  if (inhibitor.strength === 'weak') {
    return {
      inhibitor: null, // Don't show weak inhibitors in the main inhibitor field
      adjustedActivityScore: genotypeAS,
      adjustedPhenotype: genotypePhenotype,
      phenoconverted: false,
      confidence: 'standard',
      inhibitorNote: 'Weak CYP2D6 inhibitor present: no activity-score adjustment (CPIC adjusts strong and moderate only).'
    };
  }

  // Codeine/tramadol phenoconversion rules (CPIC opioids 2021)
  if (drug === 'codeine' || drug === 'tramadol') {
    const adjustedAS = inhibitor.strength === 'strong' ? 0 : genotypeAS * 0.5;
    const adjustedPhenotype = activityScoreToPhenotype(adjustedAS);
    const isUM = genotypeAS > 2.25;
    const reducedConfidence = isUM && inhibitor.strength === 'strong';

    return {
      inhibitor,
      adjustedActivityScore: adjustedAS,
      adjustedPhenotype,
      phenoconverted: true,
      confidence: reducedConfidence ? 'reduced' : 'standard',
      // R20: show the caveat that UMs may not fully phenoconvert; both recommendations are shown.
      ...(reducedConfidence ? { inhibitorNote: umReducedConfidenceNote(inhibitor.drug, drug) } : {})
    };
  }

  // Should not reach here for supported drugs
  return defaultResult;
}
