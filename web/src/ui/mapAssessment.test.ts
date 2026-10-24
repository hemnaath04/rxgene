// mapAssessment.ts tests: toRxGeneResult against the real engine (checkOrder) for every
// preset patient named in the brief. No fixtures invented here — each case runs the real
// engine on the preset patient/meds from data/patients.ts, exactly as the backend will.
import { describe, expect, it } from 'vitest';
import { findPatient } from '@/data/patients';
import { checkOrder } from '@/engine';
import { ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE } from '@/engine/fixedTexts';
import { primaryAssessment, toRxGeneResult } from './mapAssessment';

function run(patientId: string, addedDrug: string) {
  const patient = findPatient(patientId)!;
  const assessments = checkOrder(patient, addedDrug);
  const allMeds = [...patient.meds, addedDrug];
  const result = toRxGeneResult(assessments, patient, addedDrug, allMeds);
  return { patient, assessments, result: result! };
}

describe('toRxGeneResult — preset cases', () => {
  it('Sarah (P01) + codeine: RED, Slow, inhibited, score 2.0 -> 0', () => {
    const { result } = run('P01', 'codeine');
    expect(result.verdict.level).toBe('RED');
    expect(result.currentSpeed).toBe('Slow');
    expect(result.flowState).toBe('inhibited');
    expect(result.scoreBefore).toBe('2.0');
    expect(result.scoreAfter).toBe('0');
  });

  it('Marcus (P02) + codeine: RED, Slow, note contains "adds no further effect"', () => {
    const { result } = run('P02', 'codeine');
    expect(result.verdict.level).toBe('RED');
    expect(result.currentSpeed).toBe('Slow');
    expect(result.clinicalNotes?.some(n => n.includes('adds no further effect'))).toBe(true);
  });

  it('Priya (P03) + codeine: GREEN, Normal, qualifier "(not the same as safe)"', () => {
    const { result } = run('P03', 'codeine');
    expect(result.verdict.level).toBe('GREEN');
    expect(result.currentSpeed).toBe('Normal');
    expect(result.verdict.qualifier).toBe('(not the same as safe)');
  });

  it('Tom (P20) + codeine: GREY, currentSpeed null, flowState notAssessed', () => {
    const { result } = run('P20', 'codeine');
    expect(result.verdict.level).toBe('GREY');
    expect(result.currentSpeed).toBeNull();
    expect(result.flowState).toBe('notAssessed');
  });

  it('Dev (P06) + codeine: rationale or evidence keeps "reduced confidence"', () => {
    const { result } = run('P06', 'codeine');
    const haystack = `${result.verdict.rationale} ${result.evidenceBody ?? ''} ${(result.clinicalNotes ?? []).join(' ')}`;
    expect(haystack.toLowerCase()).toContain('reduced confidence');
  });

  it('Jordan (P13) + atomoxetine: YELLOW, never "Avoid"', () => {
    const { result } = run('P13', 'atomoxetine');
    expect(result.verdict.level).toBe('YELLOW');
    const haystack = `${result.verdict.headline} ${result.verdict.rationale}`;
    expect(haystack).not.toMatch(/Avoid/);
  });

  it('Lena (P12) reverse case: adding fluoxetine re-alerts codeine with the prefix', () => {
    const { result } = run('P12', 'fluoxetine');
    expect(result.verdict.kicker).toBe('Adding fluoxetine affects a current medication:');
  });

  it('Ana (ANA) + clopidogrel: the clopidogrel label note is present', () => {
    const { result } = run('ANA', 'clopidogrel');
    expect(result.clinicalNotes?.some(n => n.toLowerCase().includes('omeprazole'))).toBe(true);
  });

  it('Marcus (P02) + codeine: caption names the inhibitor and "adds no further effect"', () => {
    const { result } = run('P02', 'codeine');
    expect(result.caption).toContain('adds no further effect');
    expect(result.caption).toContain('Fluoxetine');
  });

  it('Lena (P12) reverse case: drugLabel is the primary assessment drug (Codeine), not the added drug', () => {
    const { result } = run('P12', 'fluoxetine');
    expect(result.drugLabel).toBe('Codeine');
  });

  it('Jordan (P13) + atomoxetine: label phenotype shows null score before/after and the label text as the note', () => {
    const { result } = run('P13', 'atomoxetine');
    expect(result.scoreBefore).toBeNull();
    expect(result.scoreAfter).toBeNull();
    expect(result.scoreNote).toBe(ATOMOXETINE_LABEL_ADJUSTED_PHENOTYPE);
  });

  it('Priya (P03) + codeine: GREEN headline has no "safe", qualifier carries it once', () => {
    const { result } = run('P03', 'codeine');
    expect(result.verdict.headline).not.toContain('safe');
    expect(result.verdict.qualifier).toBe('(not the same as safe)');
  });
});

describe('toRxGeneResult — never emits "safe" except "(not the same as safe)"', () => {
  const cases: Array<[string, string]> = [
    ['P01', 'codeine'],
    ['P02', 'codeine'],
    ['P03', 'codeine'],
    ['P12', 'fluoxetine'],
    ['P06', 'codeine'],
    ['P13', 'atomoxetine'],
    ['P20', 'codeine'],
    ['ANA', 'clopidogrel'],
  ];

  for (const [patientId, drug] of cases) {
    it(`${patientId} + ${drug}: no stray "safe"`, () => {
      const { result } = run(patientId, drug);
      const strings = [
        result.caption,
        result.outputLabel,
        result.baselineLabel,
        result.currentLabel,
        result.verdict.headline,
        result.verdict.rationale,
        result.verdict.qualifier ?? '',
        result.evidenceBody ?? '',
        ...(result.clinicalNotes ?? []),
      ].join('\n');

      // Strip every allowed occurrence, then the word "safe" must not remain.
      const withoutAllowed = strings.replace(/\(not the same as safe\)/gi, '');
      expect(withoutAllowed.toLowerCase()).not.toContain('safe');
    });
  }
});

describe('primaryAssessment', () => {
  it('orders RED > YELLOW > GREY > GREEN', () => {
    const base = {
      triggeredBy: 'x',
      gene: 'CYP2D6' as const,
      genotype: '*1/*1',
      genotypeActivityScore: 2,
      genotypePhenotype: 'Normal Metabolizer',
      inhibitor: null,
      adjustedActivityScore: 2,
      adjustedPhenotype: 'Normal Metabolizer',
      phenoconverted: false,
      confidence: 'standard' as const,
      recommendation: '',
      strength: '',
      source: { guideline: '', url: '', fetched: '' },
    };
    const green = { ...base, drug: 'a', alert: 'GREEN' as const };
    const red = { ...base, drug: 'b', alert: 'RED' as const };
    const yellow = { ...base, drug: 'c', alert: 'YELLOW' as const };
    const grey = { ...base, drug: 'd', alert: 'GREY' as const };

    expect(primaryAssessment([green, yellow, grey, red])?.drug).toBe('b');
    expect(primaryAssessment([green, yellow, grey])?.drug).toBe('c');
    expect(primaryAssessment([green, grey])?.drug).toBe('d');
    expect(primaryAssessment([green])?.drug).toBe('a');
    expect(primaryAssessment([])).toBeNull();
  });
});
