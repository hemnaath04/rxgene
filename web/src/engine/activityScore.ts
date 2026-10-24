// Activity score calculation for CYP2D6 diplotypes
// Rules from .kiro/steering/clinical-rules.md

import { cyp2d6Alleles } from './data.js';

export type ActivityScoreResult = {
  activityScore: number | null;
  phenotype: string;
  reason?: string;
};

/**
 * Resolve one allele (possibly a duplication like "*1x2" or "*4x2") to its activity value.
 * 1. If the data has a row for the exact name (e.g. "*1x2", "*1x≥3"), use that row's value.
 * 2. Otherwise split "<allele>x<copies>" (e.g. "*4x2" -> "*4", 2) and multiply the
 *    allele's activity value by the copy number (R2).
 * Returns undefined if the allele is not in the data, null if it has no activity value.
 */
function resolveAlleleValue(allele: string): { name: string; value: number | null | undefined } {
  if (cyp2d6Alleles.has(allele)) {
    return { name: allele, value: cyp2d6Alleles.get(allele) };
  }

  const match = allele.match(/^(\*.+?)x(\d+)$/);
  if (!match) {
    return { name: allele, value: undefined };
  }

  const baseName = match[1];
  const copyNumber = parseInt(match[2], 10);
  const baseValue = cyp2d6Alleles.get(baseName);

  if (baseValue === undefined || baseValue === null) {
    return { name: baseName, value: baseValue };
  }
  return { name: allele, value: baseValue * copyNumber };
}

/**
 * Compute CYP2D6 activity score from a diplotype string like "*1/*4" or "*1x2/*2"
 * AS = sum of the two allele activity values
 * For duplications (*1x2), multiply the allele value by the copy number
 * 
 * Returns null if any allele is unknown or has no activity value
 */
export function computeCYP2D6ActivityScore(diplotype: string): ActivityScoreResult {
  // Split diplotype
  const alleles = diplotype.split('/');
  if (alleles.length !== 2) {
    return {
      activityScore: null,
      phenotype: 'Indeterminate (invalid diplotype format)',
      reason: 'invalid format'
    };
  }

  let totalScore = 0;

  for (const alleleStr of alleles) {
    const { name: alleleName, value: activityValue } = resolveAlleleValue(alleleStr.trim());
    
    if (activityValue === undefined) {
      // Allele not in the database
      return {
        activityScore: null,
        phenotype: `Indeterminate (allele '${alleleName}' has no CPIC activity value)`,
        reason: 'unknown allele'
      };
    }
    
    if (activityValue === null) {
      // Allele exists but has no activity value (n/a)
      return {
        activityScore: null,
        phenotype: `Indeterminate (allele '${alleleName}' has no CPIC activity value)`,
        reason: 'no activity value'
      };
    }
    
    totalScore += activityValue;
  }

  // Defensive: never let a non-numeric score reach phenotype mapping or cards
  if (!Number.isFinite(totalScore)) {
    return {
      activityScore: null,
      phenotype: `Indeterminate (diplotype '${diplotype}' has no CPIC activity value)`,
      reason: 'non-numeric activity score'
    };
  }

  return {
    activityScore: totalScore,
    phenotype: '' // Will be set by phenotype.ts
  };
}

/**
 * Compute activity score for a patient, handling missing genotype
 */
export function getActivityScore(genotype: string | undefined): ActivityScoreResult {
  if (!genotype || genotype === '') {
    return {
      activityScore: null,
      phenotype: 'Insufficient data (no CYP2D6 result)',
      reason: 'missing genotype'
    };
  }

  return computeCYP2D6ActivityScore(genotype);
}
