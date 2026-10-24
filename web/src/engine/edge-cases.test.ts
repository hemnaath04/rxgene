// Edge cases not covered by the 22 fixtures: duplications, '≥' values, R21 de-escalation

import { describe, it, expect } from 'vitest';
import { checkOrder } from './checkOrder';
import { toCdsCard } from './cdsCard';
import { getActivityScore } from './activityScore';
import { codeineRecs } from './data';
import type { Patient } from './types';

function patient(cyp2d6: string, meds: string[] = []): Patient {
  return { id: 'edge', name: 'edge', cyp2d6, meds };
}

function codeineAssessment(p: Patient) {
  const a = checkOrder(p, 'codeine').find(x => x.drug === 'codeine');
  expect(a).toBeDefined();
  return a!;
}

describe('R2 duplications', () => {
  it("'*4x2/*1' splits *4x2 into *4 x 2 copies: AS 1.0", () => {
    const result = getActivityScore('*4x2/*1');
    expect(result.activityScore).toBeCloseTo(1.0, 5);

    const a = codeineAssessment(patient('*4x2/*1'));
    expect(a.genotypeActivityScore).toBeCloseTo(1.0, 5);
    expect(a.genotypePhenotype).toBe('Intermediate Metabolizer');
  });

  it("'*1x2' still uses the data's own duplication row", () => {
    expect(getActivityScore('*1x2/*2').activityScore).toBeCloseTo(3.0, 5);
  });
});

describe("'≥X' activity values never become NaN", () => {
  it("'*1x≥3/*1' gives a numeric AS, a real recommendation and no NaN in the assessment or card", () => {
    const a = codeineAssessment(patient('*1x≥3/*1'));

    expect(Number.isFinite(a.genotypeActivityScore)).toBe(true);
    expect(a.genotypeActivityScore).toBeCloseTo(4.0, 5);
    expect(a.genotypePhenotype).toBe('Ultrarapid Metabolizer');
    expect(a.alert).not.toBe('GREY');

    // Recommendation text comes from the data, not from the test
    const texts = codeineRecs.map(r => r.drugrecommendation);
    expect(texts).toContain(a.recommendation);

    const card = toCdsCard(a);
    expect(JSON.stringify(a)).not.toContain('NaN');
    expect(JSON.stringify(card)).not.toContain('NaN');
    expect(card.summary).not.toContain('NaN');
    expect(card.detail).not.toContain('NaN');
  });
});

describe('R21 already-poor-metabolizer de-escalation', () => {
  it("'*4/*4' with sertraline (weak) on the list, codeine added: adds-no-further-effect note, RED", () => {
    const a = codeineAssessment(patient('*4/*4', ['sertraline']));

    expect(a.alert).toBe('RED');
    expect(a.genotypePhenotype).toBe('Poor Metabolizer');
    expect(a.adjustedPhenotype).toBe('Poor Metabolizer');
    expect(a.inhibitorNote).toBe(
      'sertraline adds no further effect — this patient was already a poor metabolizer by genotype.'
    );
  });

  it("'*4/*4' with duloxetine (moderate), codeine added: same note, RED", () => {
    const a = codeineAssessment(patient('*4/*4', ['duloxetine']));

    expect(a.alert).toBe('RED');
    expect(a.inhibitorNote).toContain('adds no further effect');
  });
});
