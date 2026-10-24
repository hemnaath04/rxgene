// Pure adapter: engine DrugAssessment[] -> RxGeneResult (the RxGeneUI view-model). No clinical
// decisions here — every level, phenotype, recommendation and note comes straight from the
// engine or from the existing lib/verdict.ts + lib/moleculeFlow.ts wording helpers, reused
// verbatim. This file only reshapes already-decided fields into the shape RxGeneUI expects.
//
// Primary assessment = the most severe entry (RED > YELLOW > GREY > GREEN), via
// lib/verdict.ts's existing severity order. The rest stay available for the Evidence sheet
// (via clinicalNotes/requirementIds and the caller's own CardEntry list — this file does not
// own that sheet).
import { ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE, GREEN_ALERT_TEXT, GREEN_SCOPE_TEXT } from '@/engine/fixedTexts';
import type { DrugAssessment, Patient } from '@/engine/types';
import { flowStateFor } from '@/lib/moleculeFlow';
import { requirementsFor } from '@/lib/requirements';
import {
  alreadySlowInhibitor,
  capitalize,
  formatScore,
  populationLine,
  sourceLine,
  speedOf,
} from '@/lib/verdict';
import type { FlowSpeed, FlowState, InhibitorView, RxGeneResult, SourceLink } from '@/ui/types';

/** RED > YELLOW > GREY > GREEN (lib/verdict.ts SEVERITY, duplicated here for sorting assessments). */
const SEVERITY: Record<DrugAssessment['alert'], number> = { RED: 0, YELLOW: 1, GREY: 2, GREEN: 3 };

/** Pick the most severe assessment; ties keep the engine's own order (added drug first). */
export function primaryAssessment(assessments: DrugAssessment[]): DrugAssessment | null {
  if (assessments.length === 0) return null;
  return assessments
    .map((a, i) => ({ a, i }))
    .sort((x, y) => SEVERITY[x.a.alert] - SEVERITY[y.a.alert] || x.i - y.i)[0].a;
}

/** Poor -> Slow, Intermediate -> Reduced, Normal -> Normal, Ultrarapid -> Fast; else null. */
function speedFor(phenotype: string | null | undefined): FlowSpeed | null {
  if (!phenotype) return null;
  if (phenotype === ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE) return 'Slow';
  return speedOf(phenotype);
}

/** "Normal by genes" / "Poor-metabolizer-equivalent dosing (FDA label)" style baseline label. */
function baselineLabelFor(a: DrugAssessment): string {
  const speed = speedFor(a.genotypePhenotype);
  if (speed) return `${speed} by genes`;
  if (a.genotypePhenotype.startsWith('Insufficient')) return 'No gene result on file';
  if (a.genotypePhenotype.startsWith('Indeterminate')) return "Gene result can't be read";
  return a.genotypePhenotype;
}

/** Big current-response word / fallback label, per the Speed map rules. */
function currentSpeedAndLabel(a: DrugAssessment): { currentSpeed: FlowSpeed | null; currentLabel: string } {
  if (a.adjustedPhenotype === 'not computed') return { currentSpeed: null, currentLabel: 'Not assessed' };
  if (a.adjustedPhenotype.startsWith('Indeterminate') || a.adjustedPhenotype.startsWith('Insufficient')) {
    return { currentSpeed: null, currentLabel: 'Not assessed' };
  }
  const speed = speedFor(a.adjustedPhenotype);
  if (speed) return { currentSpeed: speed, currentLabel: speed };
  // A real, computed, non-speed phenotype (e.g. a CYP2C19 phenotype without a Poor/Normal/etc
  // prefix recognized by speedOf) still has a label; show it verbatim rather than "Not assessed".
  return { currentSpeed: null, currentLabel: a.adjustedPhenotype };
}

/** flowState per the spec: GREY -> notAssessed; strong/moderate phenoconversion -> inhibited/reduced; etc. */
function flowStateAndInhibitor(a: DrugAssessment): { flowState: FlowState; inhibitor: InhibitorView | null } {
  const flowState = flowStateFor(a, true, false);
  const noEffect = !!alreadySlowInhibitor(a);
  const inhibitor: InhibitorView | null = a.inhibitor
    ? {
        drug: capitalize(a.inhibitor.drug),
        strengthLabel: noEffect ? 'No further effect' : `${capitalize(a.inhibitor.strength)} inhibitor`,
        noEffect,
      }
    : null;
  return { flowState, inhibitor };
}

/** Score pair for the right column, or nulls when there is nothing to show. */
function scorePair(a: DrugAssessment): { scoreBefore: string | null; scoreAfter: string | null; scoreNote: string | null } {
  if (a.adjustedPhenotype === ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE) {
    return {
      scoreBefore: null,
      scoreAfter: null,
      scoreNote: ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE,
    };
  }
  const before = formatScore(a.genotypeActivityScore);
  const after = a.adjustedActivityScoreLabel ?? formatScore(a.adjustedActivityScore);
  if (before === null && after === null) return { scoreBefore: null, scoreAfter: null, scoreNote: null };
  const note = a.phenoconverted ? 'Rule-adjusted' : before !== null && after !== null && before === after ? 'Same as genes' : null;
  return { scoreBefore: before, scoreAfter: after ?? null, scoreNote: note };
}

/** Plain output label near the enzyme. Reuses the same drug-specific wording as moleculeFlow. */
function outputLabelFor(a: DrugAssessment, flowState: FlowState): string {
  const speed = speedFor(a.adjustedPhenotype);
  const lower = speed === 'Slow' || speed === 'Reduced';
  if (flowState === 'notAssessed') return a.adjustedPhenotype === 'not computed' ? 'Not computed' : 'Not assessed';
  if (flowState === 'guidance') {
    if (a.drug === 'atomoxetine') return lower ? 'Reduced clearance — see dosing guidance' : 'See CPIC/label dosing guidance';
    if (a.drug === 'clopidogrel') return lower ? 'Reduced activation — see guidance' : 'Genotype-based guidance';
    return 'See dosing guidance';
  }
  if (a.drug === 'codeine') return lower ? 'Reduced morphine formation' : speed === 'Fast' ? 'More morphine formation' : 'Morphine formation';
  if (a.drug === 'tramadol') return lower ? 'Less active painkiller formed' : speed === 'Fast' ? 'More active painkiller formed' : 'Active painkiller formed';
  return speed ? 'Drug processing' : 'Effect not assessed';
}

/** One explanatory sentence centered under the scene. */
function captionFor(a: DrugAssessment, patientName: string): string {
  const alreadySlow = alreadySlowInhibitor(a);
  if (alreadySlow) {
    return `${capitalize(alreadySlow)} adds no further effect: ${patientName} was already slow by genes.`;
  }
  if (a.inhibitor && a.phenoconverted) {
    return `${capitalize(a.inhibitor.drug)} reduces ${a.gene} activity. ${patientName}\u2019s genes are unchanged.`;
  }
  if (a.adjustedPhenotype === 'not computed') {
    return `RxGene cannot work out ${a.drug}'s effect with the current medications. ${patientName}\u2019s genes are unchanged.`;
  }
  if (a.alert === 'GREY') {
    return `This combination is not assessed. ${patientName}\u2019s genes are unchanged.`;
  }
  return `No ${a.gene} inhibitor changes this result. ${patientName}\u2019s genes are unchanged.`;
}

/** Headline per level, reusing the engine's own CPIC text where the level depends on its wording. */
function headlineFor(a: DrugAssessment): string {
  switch (a.alert) {
    case 'RED': {
      if (a.drug === 'clopidogrel' && a.recommendation) {
        const m = a.recommendation.match(/^.*?\.(?=\s|$)/);
        if (m) return m[0];
      }
      return `Avoid ${a.drug}.`;
    }
    case 'YELLOW':
      return a.drug === 'atomoxetine' ? 'Adjust atomoxetine dosing.' : `Review ${a.drug} dosing.`;
    case 'GREEN':
      return GREEN_ALERT_TEXT.replace(/\s*\(not the same as safe\)$/, '');
    case 'GREY':
    default:
      if (a.genotypePhenotype.startsWith('Indeterminate')) return 'Indeterminate: ask a pharmacist';
      if (a.genotypePhenotype.startsWith('Insufficient')) return 'Insufficient data';
      return 'Not assessed: refer to pharmacist';
  }
}

/** Plain rationale (1-2 lines), reusing the same wording rules as lib/verdict.ts sentenceFor. */
function rationaleFor(a: DrugAssessment): string {
  const Drug = capitalize(a.drug);
  const rec = a.recommendation.toLowerCase();
  switch (a.alert) {
    case 'RED':
      if (rec.includes('diminished analgesia')) return `${Drug} likely won't relieve pain for this patient. Consider an alternative.`;
      if (rec.includes('toxicity')) return `${Drug} could cause serious side effects for this patient. Consider an alternative.`;
      return a.recommendation;
    case 'YELLOW':
      // The full FDA label text is too long for the verdict band; the Evidence sheet shows it verbatim.
      if (a.drug === 'atomoxetine' && a.labelRecommendation) {
        return 'Atomoxetine may build up in this patient. The FDA label advises a longer titration interval (4 weeks). Full label text in Evidence.';
      }
      if (a.drug === 'atomoxetine') return `Atomoxetine may build up in this patient. CPIC: ${a.recommendation}`;
      if (a.drug === 'codeine' || a.drug === 'tramadol') return `${Drug} may relieve pain less well for this patient. CPIC: ${a.recommendation}`;
      return `CPIC gives a modified plan: ${a.recommendation}`;
    case 'GREEN':
      return `RxGene has no guideline-backed PGx flag for ${a.drug} with this gene result.`;
    case 'GREY':
    default:
      return a.recommendation || `${Drug} can't be checked against this gene result.`;
  }
}

/** Every qualifier that has no dedicated RxGeneUI slot: kept visible via clinicalNotes. */
function clinicalNotesFor(a: DrugAssessment): string[] {
  const notes: string[] = [];
  const alreadySlow = alreadySlowInhibitor(a);
  if (alreadySlow) {
    notes.push(`${capitalize(alreadySlow)} adds no further effect: this patient was already slow by genes.`);
  } else if (a.inhibitorNote?.startsWith('Weak')) {
    notes.push('A weak CYP2D6 inhibitor is on the list. It doesn\u2019t change the activity score (CPIC adjusts strong and moderate only).');
  } else if (a.inhibitorNote) {
    notes.push(a.inhibitorNote);
  }
  if (a.confidence === 'reduced') {
    notes.push('Reduced confidence: ultrarapid metabolizers may not fully phenoconvert (CPIC 2023).');
    if (a.genotypeRecommendation) notes.push(`Genotype (unconverted) recommendation: ${a.genotypeRecommendation}`);
  }
  if (a.labelNote) notes.push(a.labelNote);
  const population = populationLine(a);
  if (population) notes.push(population);
  if (a.cpicRole) notes.push(a.cpicRole);
  if (a.discrepancyFlag) notes.push(a.discrepancyFlag);
  if (a.genotypePhenotype !== a.adjustedPhenotype) {
    notes.push(`By genes: ${a.genotypePhenotype}. With current medications: ${a.adjustedPhenotype}.`);
  }
  return notes;
}

function sourceLinksFor(a: DrugAssessment): SourceLink[] {
  const links: SourceLink[] = [];
  if (a.source.guideline) links.push({ label: `CPIC ${a.source.guideline}`, url: a.source.url || undefined });
  if (a.sourceLinks) {
    for (const part of a.sourceLinks.split(' | ')) {
      const m = part.match(/^(.*?):\s*(https?:\/\/\S+)$/);
      links.push(m ? { label: m[1], url: m[2] } : { label: part });
    }
  }
  return links;
}

/**
 * Map engine assessments (from checkOrder) plus the patient and the drug just added into the
 * RxGeneUI view-model. Pure and synchronous: no fetch, no clinical computation. `assessments`
 * is the full list from one check (added drug first; reverse-case entries after). `allMeds`
 * is the full medication list of the check (current meds + the added drug), used only to
 * surface R13 ("several inhibitors") in requirementIds; it changes no clinical decision.
 */
export function toRxGeneResult(
  assessments: DrugAssessment[],
  patient: Patient,
  _addedDrug: string,
  allMeds: string[] = patient.meds
): RxGeneResult | undefined {
  const primary = primaryAssessment(assessments);
  if (!primary) return undefined;

  const { currentSpeed, currentLabel } = currentSpeedAndLabel(primary);
  const { flowState, inhibitor } = flowStateAndInhibitor(primary);
  const { scoreBefore, scoreAfter, scoreNote } = scorePair(primary);
  const baselineSpeed = speedFor(primary.genotypePhenotype);

  const level = primary.alert;
  const headline = headlineFor(primary);
  const rationale = rationaleFor(primary);
  // Reverse case (Lena): adding fluoxetine re-alerts codeine already on the list.
  // Only when the added drug is the inhibitor that changed this result; otherwise a GREY result for
  // an unrelated current medication would wrongly read as caused by the added drug.
  const prefix = primary.triggeredBy.toLowerCase() !== primary.drug.toLowerCase()
    && primary.inhibitor?.drug.toLowerCase() === primary.triggeredBy.toLowerCase()
    ?`Adding ${primary.triggeredBy} affects a current medication:`
    : null;

  const sourceLinks = sourceLinksFor(primary);
  const source = sourceLine(primary);

  const result: RxGeneResult = {
    gene: primary.gene,
    diplotype: primary.genotype ?? '\u2014',
    baselineLabel: baselineLabelFor(primary),
    baselineSpeed,
    drugLabel: capitalize(primary.drug),
    currentSpeed,
    currentLabel,
    scoreBefore,
    scoreAfter,
    scoreNote,
    outputLabel: outputLabelFor(primary, flowState),
    flowState,
    inhibitor,
    caption: captionFor(primary, patient.name),
    verdict: {
      level,
      kicker: prefix ?? 'Prescription review',
      headline,
      qualifier: level === 'GREEN' ? '(not the same as safe)' : undefined,
      rationale,
      source: source ?? undefined,
      explanationAvailable: true,
    },
    evidenceTitle: `${capitalize(primary.drug)} \u00b7 ${headline}`,
    evidenceBody: [rationale, level === 'GREEN' ? GREEN_SCOPE_TEXT : null].filter(Boolean).join(' '),
    sourceLinks,
    explanationTitle: 'For the patient',
    explanationBody: undefined,
    clinicalNotes: clinicalNotesFor(primary),
    requirementIds: requirementsFor(primary, allMeds),
  };

  return result;
}
