// Core types for RxGene rule engine

export type Alert = 'RED' | 'YELLOW' | 'GREEN' | 'GREY';

export type Patient = {
  id: string;
  name: string;
  cyp2d6?: string;
  cyp2c19?: string;
  meds: string[];
};

export type DrugAssessment = {
  drug: string;                           // the drug the alert is about
  triggeredBy: string;                    // the drug just added (differs in the reverse case)
  gene: 'CYP2D6' | 'CYP2C19';
  genotype: string | null;
  genotypeActivityScore: number | null;   // null for CYP2C19 / missing / indeterminate
  genotypePhenotype: string;              // includes 'Indeterminate' and 'Insufficient data'
  inhibitor: { drug: string; strength: 'strong' | 'moderate' | 'weak' } | null;
  adjustedActivityScore: number | null;
  adjustedPhenotype: string | 'not computed';
  phenoconverted: boolean | null;
  confidence: 'standard' | 'reduced';
  alert: Alert;
  recommendation: string;                 // CPIC text verbatim, or the fixed not-assessed text
  strength: string;                       // CPIC classification
  inhibitorNote?: string;                 // de-escalation / weak-inhibitor note
  labelNote?: string;                     // e.g. omeprazole + clopidogrel
  // R20: the genotype (e.g. Ultrarapid) recommendation, shown alongside the converted one.
  genotypeRecommendation?: string;
  // R17 (atomoxetine + strong inhibitor): FDA label fields. labelRecommendation is shown FIRST.
  labelRecommendation?: string;
  cpicRole?: string;
  discrepancyFlag?: string;
  sourceLinks?: string;
  // R30: set when no curated alert level existed for the matched recommendation (GREY, never GREEN).
  dataError?: string;
  source: { guideline: string; url: string; fetched: string };
};

export type CdsCard = {
  uuid?: string;
  summary: string;
  detail: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
  };
  links?: Array<{
    label: string;
    url: string;
    type: string;
  }>;
};

// Internal data types
export type AlleleData = {
  name: string;
  activityvalue: string | null;
  clinicalfunctionalstatus: string;
};

export type Recommendation = {
  drugname: string;
  population: string;
  phenotypes: Record<string, string>;
  activityscore: Record<string, string>;
  lookupkey: Record<string, string>;
  drugrecommendation: string;
  classification: string;
  implications: Record<string, string>;
};

export type GuidelineInfo = {
  name: string;
  url: string;
};

export type InhibitorStrength = 'strong' | 'moderate' | 'weak';
