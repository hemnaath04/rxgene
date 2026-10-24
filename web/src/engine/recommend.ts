// Recommendation lookup and curated alert levels
// Rules from .kiro/steering/clinical-rules.md and .kiro/specs/rxgene-engine/requirements.md
//
// R24/R25: codeine and tramadol are looked up by PHENOTYPE (mapped from the genotype or the
//   adjusted activity score with R3–R6). No quarter-step rounding / nearest-lower fallback.
// R26: atomoxetine is looked up by ACTIVITY SCORE, adults population.
// R27: clopidogrel is looked up by CYP2C19 phenotype, CVI ACS PCI population.
// R29/R30: the alert level is read from data/alert_levels.json (curatedAlertLevel). It is never
//   inferred from the recommendation text. A missing entry gives GREY plus a data error — never GREEN.

import {
  codeineRecs,
  tramadolRecs,
  atomoxetineRecs,
  clopidogrelRecs,
  guidelines,
  drugToPopulation,
  recommendationsFetched,
  parseActivityValue,
  isAtLeastKey,
  curatedAlertLevel,
  curatedAlertEntry
} from './data.js';
import type { Alert, Recommendation } from './types.js';

export type RecommendationResult = {
  recommendation: string;
  strength: string;
  alert: Alert;
  /** R30: set when no curated alert level existed for the matched recommendation. */
  dataError?: string;
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

function fetchedFor(drug: string): string {
  return (recommendationsFetched as Record<string, string>)[drug.toLowerCase()] || '';
}

/**
 * Build a GREY result that carries a fixed clinical text (R7/R8/R18/R32) as the recommendation,
 * with the drug's guideline source attached. The fixed strings themselves live in fixedTexts.ts.
 */
export function greyFixedResult(drug: string, recommendation: string): RecommendationResult {
  return {
    recommendation,
    strength: '',
    alert: 'GREY',
    source: getGuidelineInfo(drug, fetchedFor(drug))
  };
}

/**
 * Resolve the curated alert level for a matched recommendation (R29/R30).
 * Returns GREY plus a dataError when no entry exists; never defaults to GREEN.
 */
function resolveAlert(
  drug: string,
  population: string,
  key: string
): { alert: Alert; dataError?: string } {
  const level = curatedAlertLevel(drug, population, key);
  if (level === null) {
    return {
      alert: 'GREY',
      dataError: `No curated alert level in alert_levels.json for ${drug} / ${population.trim()} / "${key}".`
    };
  }
  return { alert: level };
}

/**
 * R26: look up an atomoxetine recommendation by activity score (adults population).
 * Codeine and tramadol must NOT use this (they use lookupByPhenotype, R24/R25).
 */
export function lookupByActivityScore(
  drug: string,
  activityScore: number | null
): RecommendationResult {
  const source = getGuidelineInfo(drug, fetchedFor(drug));

  if (activityScore === null) {
    return {
      recommendation: '',
      strength: '',
      alert: 'GREY',
      dataError: `No activity score available to look up ${drug}.`,
      source
    };
  }

  const recs = getRecommendations(drug);
  const population = drugToPopulation[drug.toLowerCase()] || 'general';

  // Round to the nearest quarter step for the exact-match pass (atomoxetine keys are quarter steps).
  const roundedAS = Math.round(activityScore * 4) / 4;

  // Exact numeric match (non-'≥' keys).
  let match = recs.find(r => {
    if (r.population.trim() !== population.trim()) return false;
    const recAS = r.activityscore?.CYP2D6;
    if (!recAS || isAtLeastKey(recAS)) return false;
    const recASFloat = parseActivityValue(recAS);
    return recASFloat !== null && Math.abs(recASFloat - roundedAS) < 0.01;
  });

  // Open-ended '≥X' keys: match when AS >= X, preferring the largest X.
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

  if (!match) {
    return {
      recommendation: '',
      strength: '',
      alert: 'GREY',
      dataError: `No ${drug} recommendation found for activity score ${activityScore}.`,
      source
    };
  }

  // The curated alert level is keyed by the matched recommendation's own activity-score key.
  const key = match.activityscore.CYP2D6;
  const { alert, dataError } = resolveAlert(drug, population, key);

  return {
    recommendation: match.drugrecommendation,
    strength: match.classification,
    alert,
    ...(dataError ? { dataError } : {}),
    source
  };
}

/** R44: alert_levels.json key for CPIC's atomoxetine row '1.0 (*10 allele present)'. */
export const ATOMOXETINE_STAR10_KEY = '1.0 (*10 present)';

/**
 * R44: atomoxetine at genotype activity score exactly 1.0 with a *10 allele. The alert level
 * comes from the curated "1.0 (*10 present)" entry; the CPIC API has no row for it, so the
 * recommendation text is the row named by that entry's useRecommendationKey ("0.75").
 * A missing entry, key or row gives GREY plus a data error (R30), never GREEN.
 */
export function lookupAtomoxetineStar10(): RecommendationResult {
  const drug = 'atomoxetine';
  const source = getGuidelineInfo(drug, fetchedFor(drug));
  const population = drugToPopulation[drug];
  const entry = curatedAlertEntry(drug, population, ATOMOXETINE_STAR10_KEY);
  const recKey = entry?.useRecommendationKey;

  const match = recKey
    ? getRecommendations(drug).find(
        r => r.population.trim() === population.trim() && r.activityscore?.CYP2D6 === recKey
      )
    : undefined;

  if (!match) {
    return {
      recommendation: '',
      strength: '',
      alert: 'GREY',
      dataError: `No atomoxetine recommendation found for "${ATOMOXETINE_STAR10_KEY}" (useRecommendationKey ${recKey ?? 'missing'}).`,
      source
    };
  }

  const { alert, dataError } = resolveAlert(drug, population, ATOMOXETINE_STAR10_KEY);
  return {
    recommendation: match.drugrecommendation,
    strength: match.classification,
    alert,
    ...(dataError ? { dataError } : {}),
    source
  };
}

/**
 * R24/R25/R27: look up a recommendation by phenotype.
 * - codeine, tramadol: CYP2D6 phenotype (population 'general')
 * - clopidogrel: CYP2C19 phenotype (population 'CVI ACS PCI')
 */
export function lookupByPhenotype(
  drug: string,
  phenotype: string
): RecommendationResult {
  const source = getGuidelineInfo(drug, fetchedFor(drug));
  const recs = getRecommendations(drug);
  const population = drugToPopulation[drug.toLowerCase()] || 'general';

  const match = recs.find(r => {
    if (r.population.trim() !== population.trim()) return false;
    const recPhenotype = r.phenotypes?.CYP2D6 ?? r.phenotypes?.CYP2C19;
    return recPhenotype === phenotype;
  });

  if (!match) {
    return {
      recommendation: '',
      strength: '',
      alert: 'GREY',
      dataError: `No ${drug} recommendation found for phenotype "${phenotype}".`,
      source
    };
  }

  const { alert, dataError } = resolveAlert(drug, population, phenotype);

  return {
    recommendation: match.drugrecommendation,
    strength: match.classification,
    alert,
    ...(dataError ? { dataError } : {}),
    source
  };
}
