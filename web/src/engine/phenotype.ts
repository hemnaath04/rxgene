// Phenotype mapping from activity scores
// Rules from .kiro/steering/clinical-rules.md

import { cyp2c19Alleles } from './data';

/**
 * Map CYP2D6 activity score to phenotype label
 * 0 = Poor Metabolizer
 * 0 < AS < 1.25 = Intermediate Metabolizer
 * 1.25 <= AS <= 2.25 = Normal Metabolizer
 * > 2.25 = Ultrarapid Metabolizer
 */
export function activityScoreToPhenotype(activityScore: number): string {
  if (activityScore === 0) {
    return 'Poor Metabolizer';
  } else if (activityScore < 1.25) {
    return 'Intermediate Metabolizer';
  } else if (activityScore <= 2.25) {
    return 'Normal Metabolizer';
  } else {
    return 'Ultrarapid Metabolizer';
  }
}

/**
 * Determine CYP2C19 phenotype from diplotype
 * This uses functional status, not activity scores
 */
export function cyp2c19DiplotypeToPhenotype(diplotype: string): string {
  const alleles = diplotype.split('/');
  if (alleles.length !== 2) {
    return 'Indeterminate (invalid diplotype format)';
  }

  const statuses = alleles.map(a => {
    const status = cyp2c19Alleles.get(a.trim());
    if (!status) {
      return null;
    }
    return status;
  });

  // If any allele is unknown
  if (statuses.includes(null)) {
    return `Indeterminate (unknown CYP2C19 allele)`;
  }

  const [status1, status2] = statuses as string[];

  // Phenotype determination based on functional status pairs
  // Follows CPIC CYP2C19 phenotype rules

  // Poor Metabolizer: two no-function alleles
  if (status1.includes('No function') && status2.includes('No function')) {
    return 'Poor Metabolizer';
  }

  // Intermediate Metabolizer: one normal/increased + one no/decreased function
  const hasNormalOrIncreased = (s: string) => 
    s.includes('Normal function') || s.includes('Increased function');
  const hasNoOrDecreased = (s: string) => 
    s.includes('No function') || s.includes('Decreased function');

  if (
    (hasNormalOrIncreased(status1) && hasNoOrDecreased(status2)) ||
    (hasNoOrDecreased(status1) && hasNormalOrIncreased(status2))
  ) {
    return 'Intermediate Metabolizer';
  }

  // Likely Intermediate: one decreased + one decreased
  if (status1.includes('Decreased function') && status2.includes('Decreased function')) {
    return 'Likely Intermediate Metabolizer';
  }

  // Rapid Metabolizer: one normal + one increased
  if (
    (status1.includes('Normal function') && status2.includes('Increased function')) ||
    (status1.includes('Increased function') && status2.includes('Normal function'))
  ) {
    return 'Rapid Metabolizer';
  }

  // Ultrarapid Metabolizer: two increased function
  if (status1.includes('Increased function') && status2.includes('Increased function')) {
    return 'Ultrarapid Metabolizer';
  }

  // Normal Metabolizer: two normal function alleles
  if (status1.includes('Normal function') && status2.includes('Normal function')) {
    return 'Normal Metabolizer';
  }

  // Uncertain function cases
  if (status1.includes('Uncertain') || status2.includes('Uncertain')) {
    return 'Indeterminate (uncertain function allele)';
  }

  // Default fallback
  return 'Indeterminate';
}
