// Agent tools for the pharmacist consult agent (R46).
// Pure functions, no network calls. The patient context and addedDrug are injected;
// tools read from that context instead of from model arguments (except the drug name).
import { checkOrder } from '../../src/engine/index.js';
import type { Patient, DrugAssessment } from '../../src/engine/types.js';
import { inhibitorOnlyNotAssessedText, inhibitorOnlyNote } from '../../src/engine/fixedTexts.js';
import inhibitorsData from '../../src/data/inhibitors.json' with { type: 'json' };

/**
 * Build full assessments for R55: one per drug in allMeds, GREEN and inhibitor-only included.
 * Shared by consult.ts template fallbacks and agent.ts templateFallback.
 */
export function buildFullAssessments(patient: Patient, allMeds: string[]): DrugAssessment[] {
  const assessments: DrugAssessment[] = [];
  for (const drug of allMeds) {
    const results = checkOrder(patient, drug);
    const match = results.find(r => r.drug.toLowerCase() === drug.toLowerCase());
    
    if (match) {
      assessments.push(match);
    } else {
      // No PGx assessment. Check if it's an inhibitor-only drug.
      let inhibitorClass: string | null = null;
      for (const [cls, drugs] of Object.entries(inhibitorsData.CYP2D6) as [string, string[]][]) {
        if (drugs.includes(drug.toLowerCase())) {
          inhibitorClass = cls;
          break;
        }
      }
      
      if (inhibitorClass) {
        // Create a synthetic assessment for the inhibitor-only drug.
        assessments.push({
          drug,
          triggeredBy: drug,
          gene: 'N/A',
          genotype: null,
          genotypeActivityScore: null,
          genotypePhenotype: 'N/A',
          inhibitor: null,
          adjustedActivityScore: null,
          adjustedPhenotype: 'N/A',
          phenoconverted: null,
          confidence: 'standard',
          alert: 'GREY',
          recommendation: inhibitorOnlyNotAssessedText(drug, inhibitorClass),
          strength: 'N/A',
          source: {
            guideline: 'FDA CYP2D6 inhibitor classification',
            url: 'https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems',
            requirements: [],
            fetched: '2026-10-24'
          }
        });
      }
    }
  }
  return assessments;
}

export type ToolContext = {
  patient: Patient;
  /** Medications on the list, plus the addedDrug if there is one. */
  allMeds: string[];
  addedDrug?: string;
  /** Cached assessment results, keyed by drug name lowercase. */
  assessments: Map<string, DrugAssessment>;
};

// ---- Tool definitions (OpenAI format) ----

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
};

export const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_patient',
      description: 'Returns the patient name, genotypes and medication list.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_drug',
      description:
        "Returns the rule engine's assessment for the named drug, run against the full medication list. The assessment includes gene, genotype/adjusted phenotype, activity scores, inhibitor details, alert level, recommendation text, strength and requirement IDs. Only use this for drugs on the patient's medication list or the drug being added.",
      parameters: {
        type: 'object',
        properties: {
          drug: {
            type: 'string',
            description: 'The drug name (e.g., "codeine", "fluoxetine").'
          }
        },
        required: ['drug']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_inhibitors',
      description: 'Lists every CYP2D6 inhibitor on the medication list with its FDA class (strong, moderate, weak).',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_evidence',
      description: 'Returns the guideline name, URL, evidence strength classification and fetched date for a drug.',
      parameters: {
        type: 'object',
        properties: {
          drug: {
            type: 'string',
            description: 'The drug name.'
          }
        },
        required: ['drug']
      }
    }
  }
];

// ---- Tool implementations ----

type ToolResult = { ok: true; result: unknown } | { ok: false; error: string };

/** Compact assessment format for the agent (drops internal fields). */
type CompactAssessment = {
  drug: string;
  gene: string;
  genotypePhenotype: string;
  adjustedPhenotype: string;
  genotypeActivityScore: number | null;
  adjustedActivityScore: number | null | string;
  inhibitor: { drug: string; strength: string } | null;
  confidence: string;
  alert: string;
  recommendation: string;
  strength: string;
  requirements: string[];
  inhibitorNote?: string;
  labelNote?: string;
  population?: string;
  genotypeRecommendation?: string;
  discrepancyFlag?: string;
  labelRecommendation?: string;
  cpicRole?: string;
  adjustedActivityScoreLabel?: string;
};

function toCompactAssessment(a: DrugAssessment): CompactAssessment {
  return {
    drug: a.drug,
    gene: a.gene,
    genotypePhenotype: a.genotypePhenotype,
    adjustedPhenotype: a.adjustedPhenotype,
    genotypeActivityScore: a.genotypeActivityScore,
    adjustedActivityScore: a.adjustedActivityScore,
    inhibitor: a.inhibitor,
    confidence: a.confidence,
    alert: a.alert,
    recommendation: a.recommendation,
    strength: a.strength,
    requirements: a.source.requirements,
    ...(a.inhibitorNote ? { inhibitorNote: a.inhibitorNote } : {}),
    ...(a.labelNote ? { labelNote: a.labelNote } : {}),
    ...(a.source.population ? { population: a.source.population } : {}),
    ...(a.genotypeRecommendation ? { genotypeRecommendation: a.genotypeRecommendation } : {}),
    ...(a.discrepancyFlag ? { discrepancyFlag: a.discrepancyFlag } : {}),
    ...(a.labelRecommendation ? { labelRecommendation: a.labelRecommendation } : {}),
    ...(a.cpicRole ? { cpicRole: a.cpicRole } : {}),
    ...(a.adjustedActivityScoreLabel ? { adjustedActivityScoreLabel: a.adjustedActivityScoreLabel } : {})
  };
}

function getPatient(ctx: ToolContext): ToolResult {
  return {
    ok: true,
    result: {
      name: ctx.patient.id,
      cyp2d6: ctx.patient.cyp2d6 ?? null,
      cyp2c19: ctx.patient.cyp2c19 ?? null,
      meds: ctx.patient.meds,
      addedDrug: ctx.addedDrug ?? null
    }
  };
}

function checkDrug(ctx: ToolContext, args: { drug?: unknown }): ToolResult {
  if (typeof args.drug !== 'string' || args.drug.trim() === '') {
    return { ok: false, error: 'drug name required' };
  }
  const drug = args.drug.toLowerCase();

  // Check if the drug is on the list or is the added drug.
  const onList = ctx.allMeds.some(m => m.toLowerCase() === drug);
  if (!onList) {
    return { ok: false, error: `${args.drug} is not on the medication list or the drug being added` };
  }

  // Return cached assessment or compute it.
  let assessment = ctx.assessments.get(drug);
  if (!assessment) {
    const results = checkOrder(ctx.patient, drug);
    const match = results.find(r => r.drug.toLowerCase() === drug);
    
    if (!match) {
      // No PGx assessment for this drug. Check if it's an inhibitor-only drug.
      let inhibitorClass: string | null = null;
      for (const [cls, drugs] of Object.entries(inhibitorsData.CYP2D6) as [string, string[]][]) {
        if (drugs.includes(drug)) {
          inhibitorClass = cls;
          break;
        }
      }
      
      if (inhibitorClass) {
        // It's an inhibitor but not a PGx substrate. Build and cache the assessment.
        assessment = {
          drug: args.drug,
          triggeredBy: args.drug,
          gene: 'N/A',
          genotype: null,
          genotypeActivityScore: null,
          genotypePhenotype: 'N/A',
          inhibitor: null,
          adjustedActivityScore: null,
          adjustedPhenotype: 'N/A',
          phenoconverted: null,
          confidence: 'standard',
          alert: 'GREY',
          recommendation: inhibitorOnlyNotAssessedText(args.drug, inhibitorClass),
          strength: 'N/A',
          inhibitorNote: inhibitorOnlyNote(inhibitorClass),
          source: {
            guideline: 'FDA CYP2D6 inhibitor classification',
            url: 'https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems',
            requirements: [],
            fetched: '2026-10-24'
          }
        };
        ctx.assessments.set(drug, assessment);
        return { ok: true, result: toCompactAssessment(assessment) };
      }
      
      return { ok: false, error: `No assessment for ${args.drug}` };
    }
    assessment = match;
    ctx.assessments.set(drug, assessment);
  }

  return { ok: true, result: toCompactAssessment(assessment) };
}

function listInhibitors(ctx: ToolContext): ToolResult {
  const inhibitors: Array<{ drug: string; fdaClass: string }> = [];
  for (const med of ctx.allMeds) {
    const lower = med.toLowerCase();
    for (const [cls, drugs] of Object.entries(inhibitorsData.CYP2D6) as [string, string[]][]) {
      if (drugs.includes(lower)) {
        inhibitors.push({ drug: med, fdaClass: cls });
        break;
      }
    }
  }
  return { ok: true, result: inhibitors };
}

function getEvidence(ctx: ToolContext, args: { drug?: unknown }): ToolResult {
  if (typeof args.drug !== 'string' || args.drug.trim() === '') {
    return { ok: false, error: 'drug name required' };
  }
  const drug = args.drug.toLowerCase();

  // Get or compute the assessment.
  let assessment = ctx.assessments.get(drug);
  if (!assessment) {
    const onList = ctx.allMeds.some(m => m.toLowerCase() === drug);
    if (!onList) {
      return { ok: false, error: `${args.drug} is not on the medication list or the drug being added` };
    }
    const results = checkOrder(ctx.patient, drug);
    const match = results.find(r => r.drug.toLowerCase() === drug);
    
    if (!match) {
      // No PGx assessment. Check if it's an inhibitor-only drug.
      let inhibitorClass: string | null = null;
      for (const [cls, drugs] of Object.entries(inhibitorsData.CYP2D6) as [string, string[]][]) {
        if (drugs.includes(drug)) {
          inhibitorClass = cls;
          break;
        }
      }
      
      if (inhibitorClass) {
        // Build and cache the assessment for inhibitor-only drug.
        assessment = {
          drug: args.drug,
          triggeredBy: args.drug,
          gene: 'N/A',
          genotype: null,
          genotypeActivityScore: null,
          genotypePhenotype: 'N/A',
          inhibitor: null,
          adjustedActivityScore: null,
          adjustedPhenotype: 'N/A',
          phenoconverted: null,
          confidence: 'standard',
          alert: 'GREY',
          recommendation: inhibitorOnlyNotAssessedText(args.drug, inhibitorClass),
          strength: 'N/A',
          inhibitorNote: inhibitorOnlyNote(inhibitorClass),
          source: {
            guideline: 'FDA CYP2D6 inhibitor classification',
            url: 'https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems',
            requirements: [],
            fetched: '2026-10-24'
          }
        };
        ctx.assessments.set(drug, assessment);
      } else {
        return { ok: false, error: `No assessment for ${args.drug}` };
      }
    } else {
      assessment = match;
      ctx.assessments.set(drug, assessment);
    }
  }

  return {
    ok: true,
    result: {
      guideline: assessment.source.guideline,
      url: assessment.source.url,
      strength: assessment.strength,
      fetched: assessment.source.fetched
    }
  };
}

// ---- Executor ----

export function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): ToolResult {
  switch (name) {
    case 'get_patient':
      return getPatient(ctx);
    case 'check_drug':
      return checkDrug(ctx, args);
    case 'list_inhibitors':
      return listInhibitors(ctx);
    case 'get_evidence':
      return getEvidence(ctx, args);
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
