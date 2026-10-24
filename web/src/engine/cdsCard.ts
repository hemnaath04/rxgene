// CDS Hooks card conversion
// Maps DrugAssessment to CDS Hooks card format

import type { DrugAssessment, CdsCard } from './types.js';
import { GREEN_ALERT_TEXT, GREEN_SCOPE_TEXT } from './fixedTexts.js';

/** R31/R33: the fixed GREEN text lives in fixedTexts.ts; re-exported for existing importers. */
export { GREEN_ALERT_TEXT };

/** First sentence of a CPIC recommendation, verbatim ("Avoid clopidogrel if possible."). */
function firstSentence(text: string): string {
  const match = text.match(/^.*?\.(?=\s|$)/);
  return match ? match[0] : text;
}

/**
 * Create a plain-language summary (under 140 chars)
 */
function createSummary(assessment: DrugAssessment): string {
  const { drug, alert, phenoconverted, inhibitor } = assessment;

  if (alert === 'RED') {
    if (phenoconverted && inhibitor) {
      return `Avoid ${drug}: ${inhibitor.drug} changes how this patient's ${assessment.gene} works`;
    }
    // R38: clopidogrel PM ("Avoid clopidogrel if possible.") and IM ("Avoid standard dose
    // (75 mg) clopidogrel if possible.") differ; keep CPIC's own first sentence verbatim.
    if (drug === 'clopidogrel') {
      const lead = firstSentence(assessment.recommendation);
      if (lead && lead.length <= 110) return `${lead} (${assessment.gene} genotype)`;
    }
    return `Avoid ${drug}: PGx alert based on ${assessment.gene} genotype`;
  }

  if (alert === 'YELLOW') {
    if (phenoconverted && inhibitor) {
      return `${drug}: ${inhibitor.drug} changes how this patient's ${assessment.gene} works, review dosing guidance`;
    }
    return `${drug}: Review ${assessment.gene} dosing guidance`;
  }

  if (alert === 'GREEN') {
    return `${drug}: ${GREEN_ALERT_TEXT}`;
  }

  // GREY - use assessment state to determine reason
  const { genotypePhenotype, adjustedPhenotype, recommendation } = assessment;
  
  // Check for specific GREY reasons
  if (recommendation.toLowerCase().includes('pharmacist')) {
    return `${drug}: Refer to pharmacist`;
  }
  
  if (genotypePhenotype.includes('Indeterminate')) {
    return `${drug}: Indeterminate genotype`;
  }
  
  if (genotypePhenotype.includes('Insufficient data')) {
    return `${drug}: Insufficient data for PGx assessment`;
  }
  
  if (adjustedPhenotype === 'not computed') {
    return `${drug}: Refer to pharmacist`;
  }

  // Default GREY
  return `${drug}: Not assessed`;
}


/**
 * Create detailed markdown content for the card
 */
function createDetail(assessment: DrugAssessment): string {
  const parts: string[] = [];

  // R17: when an FDA label recommendation applies, lead with it (shown first), followed by the
  // "different guidance contexts" discrepancy flag.
  if (assessment.labelRecommendation) {
    parts.push(`**FDA label (applies directly):** ${assessment.labelRecommendation}`);
    if (assessment.discrepancyFlag) {
      parts.push(`*${assessment.discrepancyFlag}*`);
    }
    parts.push('');
  }

  // Genotype info
  if (assessment.genotype) {
    parts.push(`**Genotype:** ${assessment.gene} ${assessment.genotype}`);
  }

  // Phenotype info
  parts.push(`**Genotype Phenotype:** ${assessment.genotypePhenotype}`);
  
  if (assessment.adjustedPhenotype !== assessment.genotypePhenotype) {
    parts.push(`**Adjusted Phenotype:** ${assessment.adjustedPhenotype}`);
  }

  // Activity scores (only finite numbers are ever printed)
  const isScore = (n: number | null): n is number => n !== null && Number.isFinite(n);

  if (isScore(assessment.genotypeActivityScore)) {
    parts.push(`**Activity Score:** ${assessment.genotypeActivityScore.toFixed(2)}`);
    
    if (
      isScore(assessment.adjustedActivityScore) &&
      assessment.adjustedActivityScore !== assessment.genotypeActivityScore
    ) {
      parts.push(`**Adjusted Activity Score:** ${assessment.adjustedActivityScore.toFixed(2)}`);
    } else if (assessment.adjustedActivityScoreLabel) {
      parts.push(`**Adjusted Activity Score:** ${assessment.adjustedActivityScoreLabel}`);
    }
  }

  // Inhibitor info
  if (assessment.inhibitor) {
    parts.push(`**Inhibitor:** ${assessment.inhibitor.drug} (${assessment.inhibitor.strength})`);
  }

  if (assessment.phenoconverted) {
    parts.push(`**Phenoconversion:** Another medicine changed how this patient's genes work.`);
  }

  // Confidence
  if (assessment.confidence === 'reduced') {
    parts.push(`**Confidence:** Reduced (UMs may not fully phenoconvert, CPIC 2023)`);
  }

  // Recommendation
  parts.push('');
  if (assessment.alert === 'GREEN') {
    // R31: the GREEN text, labeled as the genotype result only (not an overall clearance).
    parts.push(`**${GREEN_ALERT_TEXT}.** ${GREEN_SCOPE_TEXT}`);
  }
  parts.push(`**Recommendation:** ${assessment.recommendation}`);

  if (assessment.strength) {
    parts.push(`**Strength:** ${assessment.strength}`);
  }

  // R17: the CPIC poor-metabolizer text is supporting genotype-based context only.
  if (assessment.cpicRole) {
    parts.push(`*${assessment.cpicRole}*`);
  }

  // R20: show BOTH the converted recommendation (above) and the genotype recommendation.
  if (assessment.genotypeRecommendation) {
    parts.push('');
    parts.push(`**Genotype (unconverted) recommendation:** ${assessment.genotypeRecommendation}`);
  }

  // Notes
  if (assessment.inhibitorNote) {
    parts.push('');
    parts.push(`*Note: ${assessment.inhibitorNote}*`);
  }

  if (assessment.labelNote) {
    parts.push('');
    parts.push(`*${assessment.labelNote}*`);
  }

  // R17: FDA label + CPIC source links.
  if (assessment.sourceLinks) {
    parts.push('');
    parts.push(`**Sources:** ${assessment.sourceLinks}`);
  }

  return parts.join('\n');
}

/**
 * Convert DrugAssessment to CDS Hooks card format
 * 
 * Indicator mapping:
 * - RED -> critical
 * - YELLOW -> warning
 * - GREEN, GREY -> info
 */
export function toCdsCard(assessment: DrugAssessment): CdsCard {
  let indicator: 'info' | 'warning' | 'critical';
  
  switch (assessment.alert) {
    case 'RED':
      indicator = 'critical';
      break;
    case 'YELLOW':
      indicator = 'warning';
      break;
    case 'GREEN':
    case 'GREY':
    default:
      indicator = 'info';
      break;
  }

  const card: CdsCard = {
    summary: createSummary(assessment),
    detail: createDetail(assessment),
    indicator,
    source: {
      label: assessment.source.guideline,
      url: assessment.source.url
    }
  };

  // Add link if we have a guideline URL
  if (assessment.source.url) {
    card.links = [
      {
        label: 'View CPIC Guideline',
        url: assessment.source.url,
        type: 'absolute'
      }
    ];
  }

  return card;
}
