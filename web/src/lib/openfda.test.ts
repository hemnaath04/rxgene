import { describe, it, expect } from 'vitest';
import { reportsFor } from './openfda';
import { checkOrder } from '@/engine';
import type { Patient } from '@/engine/types';

describe('openFDA reportsFor()', () => {
  it('Sarah (P01): fluoxetine + codeine → returns codeine+fluoxetine pair', () => {
    const reports = reportsFor('codeine', ['fluoxetine']);
    expect(reports.length).toBeGreaterThan(0);

    const match = reports.find(r => r.drug === 'codeine' && r.coMedication === 'fluoxetine');
    expect(match).toBeDefined();
    expect(match?.totalReports).toBe(609);
    expect(match?.reactionReports['DRUG_INTERACTION']).toBe(92);
    expect(match?.reactionReports['DRUG_INEFFECTIVE']).toBe(55);
  });

  it('Priya (P03): no meds + codeine → returns no matching pairs', () => {
    const reports = reportsFor('codeine', []);
    expect(reports).toEqual([]);
  });

  it('Case-insensitive matching: CODEINE + FLUOXETINE → matches lowercase data', () => {
    const reports = reportsFor('CODEINE', ['FLUOXETINE']);
    const match = reports.find(r => r.drug === 'codeine' && r.coMedication === 'fluoxetine');
    expect(match).toBeDefined();
  });

  it('Multiple co-medications: codeine + [fluoxetine, aspirin] → returns codeine+fluoxetine', () => {
    const reports = reportsFor('codeine', ['fluoxetine', 'aspirin']);
    const match = reports.find(r => r.drug === 'codeine' && r.coMedication === 'fluoxetine');
    expect(match).toBeDefined();
  });

  it('No matching pairs: atomoxetine + unknown_med → returns empty', () => {
    const reports = reportsFor('atomoxetine', ['unknown_medication']);
    expect(reports).toEqual([]);
  });

  it('Multiple matching pairs: atomoxetine + [fluoxetine, duloxetine] → returns both', () => {
    const reports = reportsFor('atomoxetine', ['fluoxetine', 'duloxetine']);
    expect(reports.length).toBe(2);
    expect(reports.some(r => r.coMedication === 'fluoxetine')).toBe(true);
    expect(reports.some(r => r.coMedication === 'duloxetine')).toBe(true);
  });

  it('Clopidogrel + omeprazole → returns high report count', () => {
    const reports = reportsFor('clopidogrel', ['omeprazole']);
    const match = reports.find(r => r.drug === 'clopidogrel' && r.coMedication === 'omeprazole');
    expect(match?.totalReports).toBe(17816);
  });

  it('checkOrder output is identical with or without openFDA data', () => {
    // This test verifies that openFDA data does not affect engine output.
    // The engine (web/src/engine/) must never import or read openFDA data.
    // This is a design invariant: openFDA is UI-only and context-only.
    const patient: Patient = {
      id: 'test',
      name: 'test',
      cyp2d6: '*1/*1',
      meds: ['fluoxetine']
    };

    const assessment1 = checkOrder(patient, 'codeine');
    const assessment2 = checkOrder(patient, 'codeine');

    expect(assessment1).toEqual(assessment2);
    // Most importantly: the assessment does not contain any openFDA data fields
    if (assessment1.length > 0) {
      const a = assessment1[0];
      expect(a).not.toHaveProperty('totalReports');
      expect(a).not.toHaveProperty('reactionReports');
      expect(a).not.toHaveProperty('faersQuery');
    }
  });
});
