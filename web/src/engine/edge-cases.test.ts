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
      'sertraline adds no further effect: already a poor metabolizer by genotype. The drug-level alert still applies.'
    );
  });

  it("'*4/*4' with duloxetine (moderate), codeine added: same note, RED", () => {
    const a = codeineAssessment(patient('*4/*4', ['duloxetine']));

    expect(a.alert).toBe('RED');
    expect(a.inhibitorNote).toContain('adds no further effect');
  });
});

// R28 reverse case (task 18). Esomeprazole is not in the engine's known drugs,
// so only the omeprazole form is tested here.
describe('R28 omeprazole added to a patient already on clopidogrel', () => {
  const R28_TEXT =
    'Label interaction: FDA clopidogrel label advises avoiding concomitant use of omeprazole or esomeprazole. Shown separately from the genotype result.';

  function cyp2c19Patient(cyp2c19: string, meds: string[]): Patient {
    return { id: 'edge', name: 'edge', cyp2d6: '', cyp2c19, meds };
  }

  it("'*1/*1' on clopidogrel, omeprazole added: re-checked clopidogrel card with the label note, still GREEN", () => {
    const results = checkOrder(cyp2c19Patient('*1/*1', ['clopidogrel']), 'omeprazole');
    const a = results.find(x => x.drug === 'clopidogrel');

    expect(a).toBeDefined();
    expect(a!.alert).toBe('GREEN');
    expect(a!.triggeredBy).toBe('omeprazole');
    expect(a!.labelNote).toBe(R28_TEXT);
    // Label-level note only: no CYP2C19 phenoconversion (R42)
    expect(a!.phenoconverted).toBe(false);
    expect(a!.inhibitor).toBeNull();
    expect(a!.genotypePhenotype).toBe('Normal Metabolizer');
    expect(a!.adjustedPhenotype).toBe('Normal Metabolizer');
  });

  it('P19 shape unchanged: omeprazole on the list, clopidogrel added -> one GREEN card with the note', () => {
    const results = checkOrder(cyp2c19Patient('*1/*17', ['omeprazole']), 'clopidogrel');

    expect(results).toHaveLength(1);
    expect(results[0].drug).toBe('clopidogrel');
    expect(results[0].triggeredBy).toBe('clopidogrel');
    expect(results[0].alert).toBe('GREEN');
    expect(results[0].genotypePhenotype).toBe('Rapid Metabolizer');
    expect(results[0].labelNote).toBe(R28_TEXT);
  });

  it('CYP2D6 *1/*1 on codeine, sertraline (weak) added: GREEN with no label note, so no re-check card', () => {
    const results = checkOrder(patient('*1/*1', ['codeine']), 'sertraline');

    expect(results.find(x => x.drug === 'codeine')).toBeUndefined();
  });
});
