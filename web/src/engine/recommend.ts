// Recommendation lookup and alert level determination
// Rules from .kiro/steering/clinical-rules.md

import {
  codeineRecs,
  tramadolRecs,
  atomoxetineRecs,
  clopidogrelRecs,
  guidelines,
  drugToPopulation,
  recommendationsFetched,
  parseActivityValue,
  isAtLeastKey
} from './data';
import type { Alert, Recommendation } from './types';

export type RecommendationResult = {
  recommendation: string;
  strength: string;
  alert: Alert;
  source: { guideline: string; url: string; fetched: string };
};

/**
 * Get recommendations for a drug
 */
function getRecommendations(drug: string): Recommendation[] {
  switch (drug.toLowerCase()) {
    case 'codeine':
      return codeineRecs;
    case 'tramadol':
      return tramadolRecs;
    case 'atomoxetine':
      return atomoxetineRecs;
    case 'clopidogrel':
      return clopidogrelRecs;
    default:
      return [];
  }
}

/**
 * Get guideline info for a drug
 */
function getGuidelineInfo(drug: string, fetched: string): { guideline: string; url: string; fetched: string } {
  let guidelineName = '';
  
  switch (drug.toLowerCase()) {
    case 'codeine':
    case 'tramadol':
      guidelineName = 'CYP2D6, OPRM1, COMT, and Opioids';
      break;
    case 'atomoxetine':
      guidelineName = 'CYP2D6 and Atomoxetine';
      break;
    case 'clopidogrel':
      guidelineName = 'CYP2C19 and Clopidogrel';
      break;
  }

  const guideline = guidelines.get(guidelineName);
  
  return {
    guideline: guidelineName,
    url: guideline?.url || '',
    fetched
  };
}

/**
 * Determine alert level from CPIC recommendation text
 * Mirrors scripts/make_expected.py lines 40-45 exactly
 * RED: starts with "avoid"
 * YELLOW: contains "if no response" OR atomoxetine PM pathway patterns
 * GREEN: all other standard recommendations
 * GREY: starts with "no recommendation"
 */
function determineAlertLevel(recommendation: string): Alert {
  const t = recommendation.toLowerCase();
  
  if (t.startsWith('no recommendation')) {
    return 'GREY';
  }
  
  if (t.startsWith('avoid')) {
    return 'RED';
  }
  
  // YELLOW conditions from Python script
  if (t.includes('if no response')) {
    return 'YELLOW';
  }
  
  // Atomoxetine PM pathway patterns
  if (t.includes('plasma concentration') && t.includes('40 mg/day and if no')) {
    return 'YELLOW';
  }
  
  if (t.includes('if no clinical response and in the absence of adverse events after 2 weeks increase')) {
    return 'YELLOW';
  }
  
  if (t.includes('40 mg/day and if no clinical response')) {
    return 'YELLOW';
  }
  
  return 'GREEN';
}

/**
 * Look up recommendation by activity score (for CYP2D6 drugs)
 * Recommendations are keyed by activity score in quarter-step increments
 */
export function lookupByActivityScore(
  drug: string,
  activityScore: number | null
): RecommendationResult {
  if (activityScore === null) {
    return {
      recommendation: 'Not assessed. No supported PGx alert can be given.',
      strength: '',
      alert: 'GREY',
      source: getGuidelineInfo(drug, '')
    };
  }

  const recs = getRecommendations(drug);
  const population = drugToPopulation[drug.toLowerCase()] || 'general';
  
  // Find matching recommendation by activity score
  // Round to nearest 0.25 for lookup
  const roundedAS = Math.round(activityScore * 4) / 4;
  
  // First try exact match (numeric keys only; '≥X' keys are handled below)
  let match = recs.find(r => {
    if (r.population.trim() !== population.trim()) return false;
    const recAS = r.activityscore?.CYP2D6;
    if (!recAS || isAtLeastKey(recAS)) return false;
    const recASFloat = parseActivityValue(recAS);
    return recASFloat !== null && Math.abs(recASFloat - roundedAS) < 0.01;
  });

  // Then open-ended '≥X' keys: match when AS >= X, preferring the largest X
  if (!match) {
    let bestX = -Infinity;
    for (const r of recs) {
      if (r.population.trim() !== population.trim()) continue;
      const recAS = r.activityscore?.CYP2D6;
      if (!recAS || !isAtLeastKey(recAS)) continue;
      const x = parseActivityValue(recAS);
      if (x !== null && activityScore >= x && x > bestX) {
        bestX = x;
        match = r;
      }
    }
  }

  // If no exact match, try to find the closest one or use phenotype-based fallback
  if (!match) {
    // For atomoxetine, AS 1.0 is the NM recommendation
    // For codeine/tramadol, use ranges
    const sorted = recs
      .filter(r =>
        r.population.trim() === population.trim() &&
        r.activityscore?.CYP2D6 &&
        !isAtLeastKey(r.activityscore.CYP2D6) &&
        parseActivityValue(r.activityscore.CYP2D6) !== null
      )
      .sort((a, b) =>
        (parseActivityValue(a.activityscore.CYP2D6) as number) -
        (parseActivityValue(b.activityscore.CYP2D6) as number)
      );
    
    // Find the appropriate bucket
    for (let i = sorted.length - 1; i >= 0; i--) {
      const recAS = parseActivityValue(sorted[i].activityscore.CYP2D6) as number;
      if (activityScore >= recAS) {
        match = sorted[i];
        break;
      }
    }
  }

  if (!match) {
    return {
      recommendation: 'Not assessed. No supported PGx alert can be given.',
      strength: '',
      alert: 'GREY',
      source: getGuidelineInfo(drug, '')
    };
  }

  const alert = determineAlertLevel(match.drugrecommendation);
  const fetchedDate = (recommendationsFetched as Record<string, string>)[drug.toLowerCase()] || '';

  return {
    recommendation: match.drugrecommendation,
    strength: match.classification,
    alert,
    source: getGuidelineInfo(drug, fetchedDate)
  };
}

/**
 * Look up recommendation by phenotype (for CYP2C19 drugs like clopidogrel)
 */
export function lookupByPhenotype(
  drug: string,
  phenotype: string
): RecommendationResult {
  const recs = getRecommendations(drug);
  const population = drugToPopulation[drug.toLowerCase()] || '';
  
  const match = recs.find(r => {
    if (population && r.population.trim() !== population.trim()) return false;
    return r.phenotypes?.CYP2C19 === phenotype;
  });

  if (!match) {
    return {
      recommendation: 'Not assessed. No supported PGx alert can be given.',
      strength: '',
      alert: 'GREY',
      source: getGuidelineInfo(drug, '')
    };
  }

  const alert = determineAlertLevel(match.drugrecommendation);
  const fetchedDate = (recommendationsFetched as Record<string, string>)[drug.toLowerCase()] || '';

  return {
    recommendation: match.drugrecommendation,
    strength: match.classification,
    alert,
    source: getGuidelineInfo(drug, fetchedDate)
  };
}

/**
 * Special case: atomoxetine + moderate inhibitor
 */
export function atomoxetineModerateInhibitorRec(): RecommendationResult {
  return {
    recommendation: 'Moderate CYP2D6 inhibitor present; no CPIC-stated adjustment for atomoxetine. Refer to pharmacist.',
    strength: '',
    alert: 'GREY',
    source: getGuidelineInfo('atomoxetine', recommendationsFetched.atomoxetine)
  };
}
