import { describe, it, expect } from 'vitest';
import { checkOrder } from '@/engine';
import { parseUrlState, resolveUrlState, serializeUrlState, toUrlState, type UrlState } from './url';

describe('url state', () => {
  it('round-trips parse -> serialize -> parse', () => {
    const states: UrlState[] = [
      { patient: 'sarah', meds: ['fluoxetine'], add: 'codeine', mode: 'ehr', lang: 'en' },
      { patient: 'lena', meds: ['codeine', 'paroxetine'], add: 'fluoxetine', mode: 'local', lang: 'es' },
      { patient: 'priya', meds: [], add: null, mode: 'ehr', lang: 'en' },
      { patient: null, meds: null, add: null, mode: 'ehr', lang: 'en' }
    ];
    for (const state of states) {
      const search = serializeUrlState(state);
      expect(parseUrlState(search)).toEqual(state);
      expect(serializeUrlState(parseUrlState(search))).toBe(search);
    }
  });

  it('keeps medications comma-separated', () => {
    const search = serializeUrlState({ patient: 'sarah', meds: ['fluoxetine', 'paroxetine'], add: 'codeine', mode: 'ehr', lang: 'en' });
    expect(search).toBe('?patient=sarah&meds=fluoxetine,paroxetine&add=codeine&mode=ehr&lang=en');
  });

  it('defaults to mode=ehr and lang=en, and normalizes case and duplicates', () => {
    expect(parseUrlState('')).toEqual({ patient: null, meds: null, add: null, mode: 'ehr', lang: 'en' });
    expect(parseUrlState('?mode=bogus&lang=fr')).toMatchObject({ mode: 'ehr', lang: 'en' });
    expect(parseUrlState('?patient=Sarah&meds=Fluoxetine,,fluoxetine&add=CODEINE&mode=LOCAL')).toEqual({
      patient: 'sarah',
      meds: ['fluoxetine'],
      add: 'codeine',
      mode: 'local',
      lang: 'en'
    });
  });

  it('accepts a patient name or ID, and writes the lowercase name back', () => {
    for (const search of ['?patient=sarah', '?patient=P01', '?patient=p01']) {
      const resolved = resolveUrlState(parseUrlState(search));
      expect(resolved.patient.id).toBe('P01');
      expect(toUrlState({ ...resolved, meds: resolved.meds }).patient).toBe('sarah');
    }
    expect(resolveUrlState(parseUrlState('?patient=nobody')).patient.id).toBe('P01');
  });

  it('/?patient=sarah&add=codeine lands on the case 1 RED alert', () => {
    const resolved = resolveUrlState(parseUrlState('?patient=sarah&add=codeine'));
    expect(resolved.patient.name).toBe('Sarah');
    expect(resolved.meds).toEqual(['fluoxetine']); // the preset list, since ?meds= is absent
    expect(resolved.add).toBe('codeine');
    expect(resolved.mode).toBe('ehr');

    const [assessment] = checkOrder({ ...resolved.patient, meds: resolved.meds }, resolved.add!);
    expect(assessment.drug).toBe('codeine');
    expect(assessment.alert).toBe('RED');
    expect(assessment.phenoconverted).toBe(true);
  });

  it('never lists the added drug as a current med', () => {
    const resolved = resolveUrlState(parseUrlState('?patient=sarah&meds=fluoxetine,codeine&add=codeine'));
    expect(resolved.meds).toEqual(['fluoxetine']);
    const url = toUrlState({ ...resolved, meds: [...resolved.meds, 'codeine'] });
    expect(url.meds).toEqual(['fluoxetine']);
    expect(url.add).toBe('codeine');
  });
});
