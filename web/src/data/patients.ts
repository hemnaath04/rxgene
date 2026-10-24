// Preset synthetic patients (build spec section 7). Tracked in git; sync-data never touches this file.
// IDs match tests/fixtures/expected_outputs.json where the case exists there.
import type { Patient } from '@/engine/types';

export type PresetPatient = Patient & {
  demoRole: string;
  /** The drug the demo adds for this patient. */
  demoDrug: string;
};

export const patients: PresetPatient[] = [
  {
    id: 'P01',
    name: 'Sarah',
    cyp2d6: '*1/*1',
    meds: ['fluoxetine'],
    demoDrug: 'codeine',
    demoRole: 'Case 1: add codeine → RED, converted poor metabolizer',
  },
  {
    id: 'P02',
    name: 'Marcus',
    cyp2d6: '*4/*4',
    meds: ['fluoxetine'],
    demoDrug: 'codeine',
    demoRole: 'De-escalation: codeine still RED, plus "adds no further effect" note',
  },
  {
    id: 'P03',
    name: 'Priya',
    cyp2d6: '*1/*1',
    meds: [],
    demoDrug: 'codeine',
    demoRole: 'Clean case: GREEN, no supported alert',
  },
  {
    id: 'P12',
    name: 'Lena',
    cyp2d6: '*1/*1',
    meds: ['codeine'],
    demoDrug: 'fluoxetine',
    demoRole: 'Reverse case: add fluoxetine → codeine re-alerted',
  },
  {
    id: 'P06',
    name: 'Dev',
    cyp2d6: '*1x2/*2',
    meds: ['paroxetine'],
    demoDrug: 'codeine',
    demoRole: 'Ultrarapid + strong inhibitor: reduced confidence',
  },
  {
    id: 'P13',
    name: 'Jordan',
    cyp2d6: '*1/*1',
    meds: ['fluoxetine'],
    demoDrug: 'atomoxetine',
    demoRole: 'Atomoxetine direction: YELLOW (drug builds up)',
  },
  {
    id: 'P20',
    name: 'Tom',
    cyp2d6: '*1/*999',
    meds: [],
    demoDrug: 'codeine',
    demoRole: 'Not assessed: GREY',
  },
  {
    // No fixture has CYP2C19 *2/*2 together with omeprazole (P17 has no meds), so this ID is new.
    id: 'ANA',
    name: 'Ana',
    cyp2c19: '*2/*2',
    meds: ['omeprazole'],
    demoDrug: 'clopidogrel',
    demoRole: 'Clopidogrel RED + omeprazole label note',
  },
];

export function findPatient(id: string): PresetPatient | undefined {
  return patients.find(p => p.id === id);
}
