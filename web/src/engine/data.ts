// Data loader - imports CPIC snapshots and inhibitor data
// web/src/data/ is a generated copy of repo-root data/ (npm run sync-data); never edit the copies.
import cyp2d6AllelesData from '@/data/cpic/cyp2d6_alleles.json';
import cyp2c19AllelesData from '@/data/cpic/cyp2c19_alleles.json';
import codeineRecsData from '@/data/cpic/recommendations/codeine.json';
import tramadolRecsData from '@/data/cpic/recommendations/tramadol.json';
import atomoxetineRecsData from '@/data/cpic/recommendations/atomoxetine.json';
import clopidogrelRecsData from '@/data/cpic/recommendations/clopidogrel.json';
import guidelinesData from '@/data/cpic/guidelines.json';
import inhibitorsData from '@/data/inhibitors.json';
import type { AlleleData, Recommendation, GuidelineInfo } from './types';

/**
 * Parse a CPIC activity value or activity-score key.
 * - '1.0' -> 1.0
 * - '≥3.0' -> 3.0 (lower bound; CPIC uses '≥' for open-ended values)
 * - 'n/a', null, or anything non-numeric -> null (never NaN)
 */
export function parseActivityValue(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value.trim().replace(/^(≥|>=)\s*/, ''));
  return value.trim() === '' || !Number.isFinite(n) ? null : n;
}

/** True when a CPIC activity-score key is open-ended ('≥X' or '>=X'). */
export function isAtLeastKey(value: string): boolean {
  return /^(≥|>=)/.test(value.trim());
}

// CYP2D6 alleles
export const cyp2d6Alleles = new Map<string, number | null>(
  (cyp2d6AllelesData.rows as AlleleData[]).map(row => [
    row.name,
    parseActivityValue(row.activityvalue)
  ])
);

export const cyp2d6AllelesFetched = cyp2d6AllelesData.fetched;

// CYP2C19 alleles - stored as functional status (no activity values)
export const cyp2c19Alleles = new Map<string, string>(
  (cyp2c19AllelesData.rows as AlleleData[]).map(row => [
    row.name,
    row.clinicalfunctionalstatus
  ])
);

export const cyp2c19AllelesFetched = cyp2c19AllelesData.fetched;

// Recommendations
export const codeineRecs = codeineRecsData.rows as Recommendation[];
export const tramadolRecs = tramadolRecsData.rows as Recommendation[];
export const atomoxetineRecs = atomoxetineRecsData.rows as Recommendation[];
export const clopidogrelRecs = clopidogrelRecsData.rows as Recommendation[];

export const recommendationsFetched = {
  codeine: codeineRecsData.fetched,
  tramadol: tramadolRecsData.fetched,
  atomoxetine: atomoxetineRecsData.fetched,
  clopidogrel: clopidogrelRecsData.fetched
};

// Guidelines
export const guidelines = new Map<string, GuidelineInfo>(
  (guidelinesData.rows as GuidelineInfo[]).map(g => [g.name, g])
);

export const guidelinesFetched = guidelinesData.fetched;

// Inhibitors
type InhibitorData = {
  _note: string;
  _source: string;
  _verified: string;
  _design_choice: string;
  CYP2D6: {
    strong: string[];
    moderate: string[];
    weak: string[];
  };
};

const inhibitorDataTyped = inhibitorsData as InhibitorData;

export const cyp2d6Inhibitors = {
  strong: new Set(inhibitorDataTyped.CYP2D6.strong.map(d => d.toLowerCase())),
  moderate: new Set(inhibitorDataTyped.CYP2D6.moderate.map(d => d.toLowerCase())),
  weak: new Set(inhibitorDataTyped.CYP2D6.weak.map(d => d.toLowerCase()))
};

export const inhibitorsVerified = inhibitorDataTyped._verified;

// Drug-to-gene mapping
export const drugToGene: Record<string, 'CYP2D6' | 'CYP2C19' | null> = {
  codeine: 'CYP2D6',
  tramadol: 'CYP2D6',
  atomoxetine: 'CYP2D6',
  clopidogrel: 'CYP2C19'
};

// Population mapping
export const drugToPopulation: Record<string, string> = {
  codeine: 'general',
  tramadol: 'general',
  atomoxetine: 'adults',
  clopidogrel: 'CVI ACS PCI '  // Note: trailing space in the data
};
