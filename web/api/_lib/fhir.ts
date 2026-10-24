// FHIR <-> engine mapping for the CDS Hooks service (architecture spec section 4).
// Also imported by the browser (cdsClient), so: no Node-only modules, and relative
// imports only (Vercel's function bundler may not resolve the '@/' alias).
import inhibitorsData from '../../src/data/inhibitors.json';
import { drugToGene } from '../../src/engine/data';

export type Gene = 'CYP2D6' | 'CYP2C19';

// ---------------------------------------------------------------------------
// Minimal FHIR R4 shapes (only the fields we read or write)
// ---------------------------------------------------------------------------

export type Coding = { system?: string; code?: string; display?: string };
export type CodeableConcept = { coding?: Coding[]; text?: string };

export type FhirResource = { resourceType: string; id?: string; [key: string]: unknown };

export type Bundle = {
  resourceType: 'Bundle';
  type?: string;
  entry?: Array<{ fullUrl?: string; resource?: FhirResource }>;
};

export type ObservationComponent = {
  code: CodeableConcept;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
};

export type Observation = FhirResource & {
  resourceType: 'Observation';
  status?: string;
  code?: CodeableConcept;
  subject?: { reference?: string };
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  component?: ObservationComponent[];
};

export type MedicationRequest = FhirResource & {
  resourceType: 'MedicationRequest';
  status?: string;
  medicationCodeableConcept?: CodeableConcept;
};

export type OrderSelectContext = {
  userId?: string;
  patientId?: string;
  selections?: string[];
  draftOrders?: Bundle | FhirResource[];
};

export type Prefetch = {
  patient?: FhirResource | null;
  pgx?: Bundle | Observation | null;
  medications?: Bundle | null;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Codes (architecture spec section 4; HGNC IDs verified 2026-10-24)
// ---------------------------------------------------------------------------

export const LOINC_SYSTEM = 'http://loinc.org';
export const LOINC_GENOTYPE = '84413-4';
export const LOINC_GENE_STUDIED = '48018-6';
export const HGNC_SYSTEM = 'http://www.genenames.org/geneId';
export const HGNC_IDS: Record<Gene, string> = {
  CYP2D6: 'HGNC:2625',
  CYP2C19: 'HGNC:2621'
};

const isLoinc = (c: Coding, code: string) =>
  c.code === code && (c.system === undefined || c.system === LOINC_SYSTEM);

const hasCode = (cc: CodeableConcept | undefined, code: string) =>
  Boolean(cc?.coding?.some(c => isLoinc(c, code)));

/** Resources from a Bundle, a bare resource, or an array of resources. */
function resourcesOf(input: unknown): FhirResource[] {
  if (!input || typeof input !== 'object') return [];
  if (Array.isArray(input)) {
    return input.filter((r): r is FhirResource => Boolean(r) && typeof r === 'object');
  }
  const obj = input as FhirResource;
  if (obj.resourceType === 'Bundle') {
    const entries = (obj as Bundle).entry;
    return Array.isArray(entries)
      ? entries.map(e => e?.resource).filter((r): r is FhirResource => Boolean(r) && typeof r === 'object')
      : [];
  }
  return typeof obj.resourceType === 'string' ? [obj] : [];
}

// ---------------------------------------------------------------------------
// Genotype
// ---------------------------------------------------------------------------

/**
 * Normalize a diplotype string to the engine's format ("*1/*4", "*1x2/*2").
 * Strips the gene prefix ("CYP2D6*1/CYP2D6*4", "CYP2D6 *1/*4") and PharmVar suballele
 * suffixes ("*1.001" -> "*1"). Returns null if the result isn't "<allele>/<allele>".
 */
export function normalizeDiplotype(raw: string, gene: Gene): string | null {
  const stripped = raw
    .replace(new RegExp(gene, 'gi'), '')
    .replace(/\s+/g, '')
    .replace(/(\*\d+)\.\d+/g, '$1');
  return /^\*[^/*]+\/\*[^/*]+$/.test(stripped) ? stripped : null;
}

function diplotypeText(obs: Observation): string | undefined {
  return obs.valueCodeableConcept?.text ?? obs.valueString ?? obs.valueCodeableConcept?.coding?.[0]?.display;
}

/**
 * Find the gene's genotype Observation (LOINC 84413-4 with a gene-studied component
 * LOINC 48018-6 = HGNC id) and return the normalized diplotype, or null.
 */
export function parseGenotype(bundle: unknown, gene: Gene): string | null {
  const hgnc = HGNC_IDS[gene];
  for (const resource of resourcesOf(bundle)) {
    if (resource.resourceType !== 'Observation') continue;
    const obs = resource as Observation;
    if (obs.status === 'entered-in-error' || obs.status === 'cancelled') continue;
    if (!hasCode(obs.code, LOINC_GENOTYPE)) continue;

    const forGene = obs.component?.some(
      comp =>
        hasCode(comp.code, LOINC_GENE_STUDIED) &&
        Boolean(comp.valueCodeableConcept?.coding?.some(c => c.code === hgnc))
    );
    if (!forGene) continue;

    const text = diplotypeText(obs);
    const diplotype = typeof text === 'string' ? normalizeDiplotype(text, gene) : null;
    if (diplotype) return diplotype;
  }
  return null;
}

/** A genotype Observation the parser above reads back (used by the client and tests). */
export function buildPgxObservation(patientId: string, gene: Gene, diplotype: string): Observation {
  return {
    resourceType: 'Observation',
    id: `pgx-${gene.toLowerCase()}-${patientId}`,
    meta: { profile: ['http://hl7.org/fhir/uv/genomics-reporting/StructureDefinition/genotype'] },
    status: 'final',
    category: [
      {
        coding: [
          { system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }
        ]
      }
    ],
    code: { coding: [{ system: LOINC_SYSTEM, code: LOINC_GENOTYPE, display: 'Genotype display name' }] },
    subject: { reference: `Patient/${patientId}` },
    valueCodeableConcept: { text: diplotype },
    component: [
      {
        code: { coding: [{ system: LOINC_SYSTEM, code: LOINC_GENE_STUDIED, display: 'Gene studied [ID]' }] },
        valueCodeableConcept: { coding: [{ system: HGNC_SYSTEM, code: HGNC_IDS[gene], display: gene }] }
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

/**
 * Known ingredients: every drug with a CPIC recommendation snapshot, every drug in
 * inhibitors.json, plus omeprazole (the engine's clopidogrel label note needs it).
 */
export const KNOWN_DRUGS: string[] = Array.from(
  new Set([
    ...Object.keys(drugToGene),
    ...inhibitorsData.CYP2D6.strong,
    ...inhibitorsData.CYP2D6.moderate,
    ...inhibitorsData.CYP2D6.weak,
    'omeprazole'
  ].map(d => d.toLowerCase()))
);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DRUG_PATTERNS = KNOWN_DRUGS.map(drug => ({
  drug,
  pattern: new RegExp(`\\b${escapeRegExp(drug)}\\b`, 'i')
}));

/** Map a medication name ("Codeine sulfate 30 mg oral tablet") to a known ingredient. */
export function matchKnownDrug(name: string | undefined): string | null {
  if (!name) return null;
  return DRUG_PATTERNS.find(p => p.pattern.test(name))?.drug ?? null;
}

function drugOf(resource: FhirResource): string | null {
  if (resource.resourceType !== 'MedicationRequest') return null;
  const concept = (resource as MedicationRequest).medicationCodeableConcept;
  const candidates = [concept?.text, ...(concept?.coding ?? []).map(c => c.display)];
  for (const name of candidates) {
    const drug = matchKnownDrug(name);
    if (drug) return drug;
  }
  return null;
}

export type RequestMeds = {
  /** Every known ingredient on the draft orders and active medications (deduplicated). */
  meds: string[];
  /** The ingredient of the draft order named in context.selections, if it is known. */
  selected: string | null;
};

/**
 * Ingredient names from every draftOrders MedicationRequest plus active
 * prefetch.medications entries, and which draft order is selected.
 */
export function medsFromRequest(context: OrderSelectContext, prefetch?: Prefetch | null): RequestMeds {
  const meds = new Set<string>();
  let selected: string | null = null;
  const selections = new Set(context.selections ?? []);

  for (const resource of resourcesOf(context.draftOrders)) {
    const drug = drugOf(resource);
    if (!drug) continue;
    meds.add(drug);
    const ref = `${resource.resourceType}/${resource.id}`;
    if (!selected && resource.id && (selections.has(ref) || selections.has(resource.id))) {
      selected = drug;
    }
  }

  for (const resource of resourcesOf(prefetch?.medications)) {
    if ((resource as MedicationRequest).status !== 'active') continue;
    const drug = drugOf(resource);
    if (drug) meds.add(drug);
  }

  return { meds: [...meds], selected };
}

/** Display name from a FHIR Patient, if present. */
export function patientName(patient: FhirResource | null | undefined): string | undefined {
  type PatientName = { text?: string; given?: string[]; family?: string };
  const names = patient ? (patient.name as PatientName[] | undefined) : undefined;
  const n = Array.isArray(names) ? names[0] : undefined;
  if (!n) return undefined;
  return n.text ?? ([...(n.given ?? []), n.family].filter(Boolean).join(' ') || undefined);
}
