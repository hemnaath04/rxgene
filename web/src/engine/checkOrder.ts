// Main engine: checkOrder() orchestrates all steps
// Implements the algorithm from .plans/rxgene-build-spec.md section 4

import type { Patient, DrugAssessment } from './types.js';
import { getActivityScore } from './activityScore.js';
import { activityScoreToPhenotype, cyp2c19DiplotypeToPhenotype } from './phenotype.js';
import { applyPhenoconversion } from './phenoconversion.js';
import { lookupByActivityScore, lookupByPhenotype, greyFixedResult, type RecommendationResult } from './recommend.js';
import { drugToGene } from './data.js';
import {
  INDETERMINATE_TEXT,
  insufficientDataText,
  ATOMOXETINE_MODERATE_NOT_ASSESSED_TEXT,
  ATOMOXETINE_LABEL_RECOMMENDATION,
  ATOMOXETINE_CPIC_ROLE,
  ATOMOXETINE_DISCREPANCY_FLAG,
  ATOMOXETINE_SOURCE_LINKS
} from './fixedTexts.js';

/**
 * Check if a drug needs a PGx alert
 */
function isSupportedDrug(drug: string): boolean {
  return drugToGene[drug.toLowerCase()] !== undefined;
}

/**
 * Assess a single drug against patient genotype and medications
 * This is the core assessment logic
 */
function assessDrug(
  drug: string,
  triggeredBy: string,
  patient: Patient,
  allMedications: string[]
): DrugAssessment | null {
  const drugLower = drug.toLowerCase();
  const gene = drugToGene[drugLower];

  if (!gene) {
    // Drug not supported
    return null;
  }

  // Get genotype
  const genotype = gene === 'CYP2D6' ? patient.cyp2d6 : patient.cyp2c19;

  // Handle CYP2D6 drugs (codeine, tramadol, atomoxetine)
  if (gene === 'CYP2D6') {
    // Step 1: Compute activity score
    const asResult = getActivityScore(genotype);

    let genotypePhenotype = asResult.phenotype;
    const genotypeAS = asResult.activityScore;

    // If we have a valid AS, map to phenotype
    if (genotypeAS !== null && !genotypePhenotype) {
      genotypePhenotype = activityScoreToPhenotype(genotypeAS);
    }

    // Step 2: Apply phenoconversion
    const phenoResult = applyPhenoconversion(
      drugLower,
      genotypeAS,
      genotypePhenotype,
      allMedications
    );

    // Fields shared by every CYP2D6 outcome.
    const base = {
      drug,
      triggeredBy,
      gene,
      genotype: genotype || null,
      genotypeActivityScore: genotypeAS,
      genotypePhenotype,
      inhibitor: phenoResult.inhibitor,
      adjustedActivityScore: phenoResult.adjustedActivityScore,
      adjustedPhenotype: phenoResult.adjustedPhenotype,
      phenoconverted: phenoResult.phenoconverted,
      confidence: phenoResult.confidence,
      inhibitorNote: phenoResult.inhibitorNote
    };

    // Step 3: Look up the recommendation and alert level.
    let recResult: RecommendationResult;
    let genotypeRecommendation: string | undefined;
    const labelFields: Partial<DrugAssessment> = {};

    if (genotypeAS === null) {
      // R7 (Indeterminate) / R8 (Insufficient data): GREY with the fixed text, no computation.
      const isInsufficient = genotypePhenotype.startsWith('Insufficient data');
      recResult = greyFixedResult(
        drugLower,
        isInsufficient ? insufficientDataText('CYP2D6') : INDETERMINATE_TEXT
      );
    } else if (drugLower === 'atomoxetine' && phenoResult.inhibitor?.strength === 'moderate') {
      // R18: moderate inhibitor + atomoxetine -> GREY "Not assessed", not computed.
      recResult = greyFixedResult('atomoxetine', ATOMOXETINE_MODERATE_NOT_ASSESSED_TEXT);
    } else if (drugLower === 'atomoxetine' && phenoResult.inhibitor?.strength === 'strong') {
      // R17: FDA label-based handling. The recommendation/alert come from the PM-equivalent
      // activity score (0), while the reported adjusted score is null ("n/a") and the adjusted
      // phenotype is the fixed FDA-label description (set in phenoconversion).
      recResult = lookupByActivityScore('atomoxetine', 0);
      labelFields.labelRecommendation = ATOMOXETINE_LABEL_RECOMMENDATION;
      labelFields.cpicRole = ATOMOXETINE_CPIC_ROLE;
      labelFields.discrepancyFlag = ATOMOXETINE_DISCREPANCY_FLAG;
      labelFields.sourceLinks = ATOMOXETINE_SOURCE_LINKS;
    } else if (drugLower === 'codeine' || drugLower === 'tramadol') {
      // R24/R25: look up by phenotype (mapped from the adjusted activity score).
      const lookupPhenotype = activityScoreToPhenotype(phenoResult.adjustedActivityScore as number);
      recResult = lookupByPhenotype(drugLower, lookupPhenotype);
      // R20: UM + strong inhibitor -> also show the genotype (UM) recommendation.
      if (phenoResult.confidence === 'reduced') {
        genotypeRecommendation = lookupByPhenotype(drugLower, genotypePhenotype).recommendation;
      }
    } else {
      // Atomoxetine with no inhibitor or a weak inhibitor: look up by activity score (R26).
      recResult = lookupByActivityScore(drugLower, phenoResult.adjustedActivityScore);
    }

    // Step 4: Build assessment
    const assessment: DrugAssessment = {
      ...base,
      alert: recResult.alert,
      recommendation: recResult.recommendation,
      strength: recResult.strength,
      ...(genotypeRecommendation ? { genotypeRecommendation } : {}),
      ...labelFields,
      ...(recResult.dataError ? { dataError: recResult.dataError } : {}),
      source: recResult.source
    };

    return assessment;
  }

  // Handle CYP2C19 drugs (clopidogrel)
  if (gene === 'CYP2C19') {
    if (!genotype || genotype === '') {
      const grey = greyFixedResult(drugLower, insufficientDataText('CYP2C19'));
      return {
        drug,
        triggeredBy,
        gene,
        genotype: null,
        genotypeActivityScore: null,
        genotypePhenotype: 'Insufficient data (no CYP2C19 result)',
        inhibitor: null,
        adjustedActivityScore: null,
        adjustedPhenotype: 'Insufficient data (no CYP2C19 result)',
        phenoconverted: null,
        confidence: 'standard',
        alert: grey.alert,
        recommendation: grey.recommendation,
        strength: grey.strength,
        source: grey.source
      };
    }

    const phenotype = cyp2c19DiplotypeToPhenotype(genotype);
    const recResult = lookupByPhenotype(drugLower, phenotype);

    // Check for omeprazole label interaction
    let labelNote: string | undefined;
    if (drugLower === 'clopidogrel') {
      const hasOmeprazole = allMedications
        .map(m => m.toLowerCase())
        .includes('omeprazole');
      
      if (hasOmeprazole) {
        labelNote = 'Label interaction: clopidogrel + omeprazole (verify against FDA label). Shown separately from genotype result.';
      }
    }

    return {
      drug,
      triggeredBy,
      gene,
      genotype,
      genotypeActivityScore: null, // CYP2C19 has no activity score
      genotypePhenotype: phenotype,
      inhibitor: null,
      adjustedActivityScore: null,
      adjustedPhenotype: phenotype,
      phenoconverted: false,
      confidence: 'standard',
      alert: recResult.alert,
      recommendation: recResult.recommendation,
      strength: recResult.strength,
      labelNote,
      ...(recResult.dataError ? { dataError: recResult.dataError } : {}),
      source: recResult.source
    };
  }

  return null;
}

/**
 * Main entry point: check an order (adding a drug to a patient's medication list)
 * 
 * Re-checks the FULL medication list, so it catches:
 * 1. The new drug being added
 * 2. Existing drugs that are now affected by the new drug (reverse case)
 * 
 * @param patient Patient with genotype and current medications
 * @param addedDrug The drug being added
 * @returns Array of drug assessments (one per alerted drug)
 */
export function checkOrder(patient: Patient, addedDrug: string): DrugAssessment[] {
  const assessments: DrugAssessment[] = [];
  
  // All medications = current meds + the drug being added
  const allMedications = [...patient.meds, addedDrug];

  // Check the drug being added
  const addedDrugAssessment = assessDrug(addedDrug, addedDrug, patient, allMedications);
  if (addedDrugAssessment) {
    assessments.push(addedDrugAssessment);
  }

  // Reverse case: check if adding this drug affects existing meds
  // Look for existing supported drugs that might now be phenoconverted
  for (const med of patient.meds) {
    if (isSupportedDrug(med)) {
      const assessment = assessDrug(med, addedDrug, patient, allMedications);
      if (assessment) {
        // Only include if there's an alert (not just GREEN/no change)
        // or if phenoconversion occurred
        if (assessment.phenoconverted || assessment.alert !== 'GREEN') {
          assessments.push(assessment);
        }
      }
    }
  }

  return assessments;
}
