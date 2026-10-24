import pairReports from '@/data/openfda/pair_reports.json';

export interface OpenFDAReport {
  drug: string;
  coMedication: string;
  totalReports: number;
  reactionReports: {
    'DRUG_INTERACTION'?: number;
    'DRUG_INEFFECTIVE'?: number;
  };
  query: string;
}

/**
 * Find matching real-world reports for a drug and its co-medications.
 * Returns matching pair rows where the drug is the assessed drug and
 * any co-medication from the list matches a coMedication in the data.
 *
 * @param drug - The drug being assessed (e.g., 'codeine')
 * @param coMedications - List of concurrent medications (e.g., ['fluoxetine', 'aspirin'])
 * @returns Array of matching reports, or empty if none found
 */
export function reportsFor(drug: string, coMedications: string[]): OpenFDAReport[] {
  if (!drug || !coMedications || coMedications.length === 0) {
    return [];
  }

  const normalizedCoMeds = coMedications.map(med => med.toLowerCase());

  return pairReports.pairs
    .filter(pair => {
      // Match on the assessed drug (case-insensitive)
      if (pair.drug.toLowerCase() !== drug.toLowerCase()) {
        return false;
      }
      // Match on any co-medication in the current list (case-insensitive)
      return normalizedCoMeds.includes(pair.coMedication.toLowerCase());
    })
    .map(pair => ({
      drug: pair.drug,
      coMedication: pair.coMedication,
      totalReports: pair.totalReports,
      reactionReports: {
        'DRUG_INTERACTION': pair.reactionReports['DRUG INTERACTION'],
        'DRUG_INEFFECTIVE': pair.reactionReports['DRUG INEFFECTIVE']
      },
      query: pair.query
    }));
}
