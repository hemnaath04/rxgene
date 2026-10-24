// Property-based tests (fast-check + vitest) for the invariants in
// .kiro/specs/rxgene-engine/requirements.md. Each describe/it name starts with its requirement tag.
// Arbitraries draw alleles and inhibitors from the CPIC / inhibitors.json snapshots, so the tests
// follow the data instead of a hand-copied list.
//
// Not implemented here: the consult-agent property (the agent is not built yet).

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkOrder } from './checkOrder';
import { toCdsCard } from './cdsCard';
import { activityScoreToPhenotype } from './phenotype';
import { cyp2d6Alleles, cyp2d6Inhibitors } from './data';
import { patients } from '../data/patients';
import type { DrugAssessment, Patient } from './types';

const NUM_RUNS = 300; // every property runs at least 200 times

// ---------------------------------------------------------------------------
// Data-driven building blocks
// ---------------------------------------------------------------------------

const usableName = (name: string) => !name.includes('/') && name.trim() === name;

/** CYP2D6 alleles with a numeric activity value in the CPIC data. */
const KNOWN_ALLELES = [...cyp2d6Alleles.entries()]
  .filter(([name, value]) => value !== null && usableName(name))
  .map(([name]) => name);

/** Alleles in the CPIC data whose activity value is 0 (no function). */
const ZERO_ALLELES = [...cyp2d6Alleles.entries()]
  .filter(([name, value]) => value === 0 && usableName(name))
  .map(([name]) => name);

/** Alleles that exist in the CPIC data but have no activity value ("n/a"): R7 says Indeterminate. */
const NO_VALUE_ALLELES = [...cyp2d6Alleles.entries()]
  .filter(([name, value]) => value === null && usableName(name))
  .map(([name]) => name);

const STRONG = [...cyp2d6Inhibitors.strong];
const MODERATE = [...cyp2d6Inhibitors.moderate];
const WEAK = [...cyp2d6Inhibitors.weak];
const ALL_INHIBITORS = [...STRONG, ...MODERATE, ...WEAK];

/** Drugs that are not CYP2D6 inhibitors in inhibitors.json (and not covered drugs). */
const NON_INHIBITORS = ['ibuprofen', 'metformin', 'lisinopril', 'atorvastatin', 'amoxicillin', 'omeprazole'].filter(
  d => !ALL_INHIBITORS.includes(d)
);

const COVERED_DRUGS = ['codeine', 'tramadol', 'atomoxetine', 'clopidogrel'] as const;
const OPIOIDS = ['codeine', 'tramadol'] as const; // R41: multiplier phenoconversion applies to these only
const CYP2D6_DRUGS = ['codeine', 'tramadol', 'atomoxetine'] as const;

type Need = 'any' | 'required' | 'none';

function group(pool: string[], need: Need): fc.Arbitrary<string[]> {
  if (need === 'none') return fc.constant([] as string[]);
  return fc.subarray(pool, { minLength: need === 'required' ? 1 : 0 });
}

/** Deterministic Fisher-Yates driven by generated integers, so shrinking stays reproducible. */
function shuffleWith<T>(list: T[], rnd: number[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd[i % rnd.length] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A medication list in random order, with each inhibitor class required, forbidden or optional. */
function medsArb(strong: Need, moderate: Need, weak: Need, other: Need = 'any'): fc.Arbitrary<string[]> {
  return fc
    .tuple(
      group(STRONG, strong),
      group(MODERATE, moderate),
      group(WEAK, weak),
      group(NON_INHIBITORS, other),
      fc.array(fc.nat(), { minLength: 1, maxLength: 40 })
    )
    .map(([s, m, w, o, rnd]) => shuffleWith([...s, ...m, ...w, ...o], rnd));
}

const noInhibitors = medsArb('none', 'none', 'none');
const strongPresent = medsArb('required', 'any', 'any');
const moderateNoStrong = medsArb('none', 'required', 'any');
const moderateOnly = medsArb('none', 'required', 'none');
const weakOnly = medsArb('none', 'none', 'required');
const mixedClasses = fc.oneof(
  medsArb('required', 'required', 'any'),
  medsArb('required', 'any', 'required'),
  medsArb('none', 'required', 'required')
);

/** Any medication list, including none. The four cases partition the possibilities. */
const anyMeds = fc.oneof(noInhibitors, strongPresent, moderateNoStrong, weakOnly);
/** Any medication list with at least one inhibitor. */
const medsWithInhibitor = fc.oneof(strongPresent, moderateOnly, moderateNoStrong, weakOnly);

const knownAllele = fc.constantFrom(...KNOWN_ALLELES);
const genotypeArb = fc.tuple(knownAllele, knownAllele).map(([a, b]) => `${a}/${b}`);

/** Allele names that are not in the CPIC data (e.g. *999), sometimes written as a duplication. */
const unknownAllele = fc
  .oneof(
    fc.constant('*999'),
    fc.integer({ min: 200, max: 99999 }).map(n => `*${n}`),
    fc.tuple(fc.integer({ min: 200, max: 99999 }), fc.integer({ min: 2, max: 4 })).map(([n, c]) => `*${n}x${c}`)
  )
  .filter(a => !cyp2d6Alleles.has(a));

/** An allele that cannot be interpreted: unknown to the data, or known with no activity value. */
const uninterpretableAllele =
  NO_VALUE_ALLELES.length > 0
    ? fc.oneof(
        { weight: 3, arbitrary: unknownAllele },
        { weight: 1, arbitrary: fc.constantFrom(...NO_VALUE_ALLELES) }
      )
    : unknownAllele;

const indeterminateGenotype = fc
  .tuple(uninterpretableAllele, fc.oneof(knownAllele, uninterpretableAllele), fc.boolean())
  .map(([bad, other, badFirst]) => (badFirst ? `${bad}/${other}` : `${other}/${bad}`));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePatient(cyp2d6: string | undefined, meds: string[]): Patient {
  return { id: 'prop', name: 'prop', ...(cyp2d6 === undefined ? {} : { cyp2d6 }), meds };
}

/** The assessment of the drug that was added (not a reverse-case re-check of an existing med). */
function assessAdded(patient: Patient, drug: string): DrugAssessment {
  const found = checkOrder(patient, drug).find(a => a.drug === drug && a.triggeredBy === drug);
  if (!found) throw new Error(`No assessment returned for ${drug}`);
  return found;
}

function strongestClass(meds: string[]): 'strong' | 'moderate' | 'weak' | null {
  const lower = meds.map(m => m.toLowerCase());
  if (lower.some(m => cyp2d6Inhibitors.strong.has(m))) return 'strong';
  if (lower.some(m => cyp2d6Inhibitors.moderate.has(m))) return 'moderate';
  if (lower.some(m => cyp2d6Inhibitors.weak.has(m))) return 'weak';
  return null;
}

/** R10-R13 stated independently of the engine: strong x0, moderate x0.5, weak or none x1. */
function expectedAdjusted(score: number, meds: string[]): number {
  switch (strongestClass(meds)) {
    case 'strong':
      return 0;
    case 'moderate':
      return score * 0.5;
    default:
      return score;
  }
}

function genotypeAS(a: DrugAssessment): number {
  expect(a.genotypeActivityScore).not.toBeNull();
  return a.genotypeActivityScore as number;
}

// ---------------------------------------------------------------------------
// 1. R33: no "safe" wording anywhere in displayed text
// ---------------------------------------------------------------------------

const ALLOWED_PHRASE = 'not the same as safe';
const BANNED_WORDS = /\b(?:safe|safely|safety|unsafe|seguro|seguridad)\b/i;

describe('R33 no safety wording in any output text', () => {
  it('preset patients x covered drugs x any inhibitor subset: only the exact phrase "not the same as safe" is allowed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...patients),
        fc.constantFrom(...COVERED_DRUGS),
        fc.shuffledSubarray(ALL_INHIBITORS),
        (preset, drug, added) => {
          const patient: Patient = { ...preset, meds: [...preset.meds, ...added] };

          for (const a of checkOrder(patient, drug)) {
            const card = toCdsCard(a);
            const texts: Array<[string, string | undefined]> = [
              ['recommendation', a.recommendation],
              ['inhibitorNote', a.inhibitorNote],
              ['labelNote', a.labelNote],
              ['card.summary', card.summary],
              ['card.detail', card.detail]
            ];
            for (const [field, text] of texts) {
              if (text === undefined) continue;
              const remaining = text.split(ALLOWED_PHRASE).join('');
              const hit = remaining.match(BANNED_WORDS);
              expect(hit, `${preset.name} + ${drug} [${added.join(', ')}] ${a.drug}.${field} contains "${hit?.[0]}"`).toBeNull();
            }
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// 2. R10/R11/R13 (codeine and tramadol only, R41): inhibitor adjustment
// ---------------------------------------------------------------------------

describe('R10/R11/R13 phenoconversion of the activity score (codeine and tramadol)', () => {
  const drugArb = fc.constantFrom(...OPIOIDS);

  it('R10/R11/R13 adjusted activity score is never above the genotype activity score', () => {
    fc.assert(
      fc.property(genotypeArb, anyMeds, drugArb, (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.adjustedActivityScore).not.toBeNull();
        expect(a.adjustedActivityScore as number).toBeLessThanOrEqual(genotypeAS(a));
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('R10 a strong inhibitor on the list gives an adjusted activity score of exactly 0', () => {
    fc.assert(
      fc.property(genotypeArb, strongPresent, drugArb, (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.adjustedActivityScore).toBe(0);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('R11 a moderate inhibitor with no strong one gives exactly 0.5 x the genotype activity score', () => {
    fc.assert(
      fc.property(genotypeArb, moderateNoStrong, drugArb, (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.adjustedActivityScore).toBe(genotypeAS(a) * 0.5);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('R11 a moderate inhibitor alone (no strong, no weak) gives exactly 0.5 x the genotype activity score', () => {
    fc.assert(
      fc.property(genotypeArb, moderateOnly, drugArb, (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.adjustedActivityScore).toBe(genotypeAS(a) * 0.5);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('R13 with inhibitors of several classes on the list, only the strongest class is applied', () => {
    fc.assert(
      fc.property(genotypeArb, mixedClasses, drugArb, (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.adjustedActivityScore).toBe(expectedAdjusted(genotypeAS(a), meds));
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('R12/R13 weak inhibitors alone (or no inhibitor) change nothing: same score and same phenotype', () => {
    fc.assert(
      fc.property(genotypeArb, fc.oneof(weakOnly, noInhibitors), drugArb, (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.adjustedActivityScore).toBe(genotypeAS(a));
        expect(a.adjustedPhenotype).toBe(a.genotypePhenotype);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// 3. R3-R6: activity score -> phenotype
// ---------------------------------------------------------------------------

describe('R3-R6 genotype phenotype is monotonic in the activity score', () => {
  // Slowest to fastest. Written out here, not read from the engine.
  const ORDER = ['Poor Metabolizer', 'Intermediate Metabolizer', 'Normal Metabolizer', 'Ultrarapid Metabolizer'];
  const rank = (phenotype: string) => ORDER.indexOf(phenotype);

  const scoreArb = fc.oneof(
    fc.double({ min: 0, max: 6, noNaN: true }),
    fc.integer({ min: 0, max: 24 }).map(n => n / 4)
  );

  it('R3-R6 a higher activity score never gives a slower phenotype (score mapping)', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (x, y) => {
        const [low, high] = x <= y ? [x, y] : [y, x];
        const lowRank = rank(activityScoreToPhenotype(low));
        const highRank = rank(activityScoreToPhenotype(high));
        expect(lowRank).toBeGreaterThanOrEqual(0);
        expect(highRank).toBeGreaterThanOrEqual(0);
        expect(highRank).toBeGreaterThanOrEqual(lowRank);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('R3-R6 a higher genotype activity score never gives a slower phenotype (through checkOrder)', () => {
    fc.assert(
      fc.property(fc.array(genotypeArb, { minLength: 2, maxLength: 6 }), genotypes => {
        const results = genotypes
          .map(g => assessAdded(makePatient(g, []), 'codeine'))
          .map(a => ({ as: genotypeAS(a), rank: rank(a.genotypePhenotype), label: a.genotypePhenotype }))
          .sort((p, q) => p.as - q.as);

        for (const r of results) expect(r.rank, `unexpected phenotype "${r.label}"`).toBeGreaterThanOrEqual(0);
        for (let i = 1; i < results.length; i++) {
          expect(results[i].rank).toBeGreaterThanOrEqual(results[i - 1].rank);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('R3-R6 boundaries are exact: 0 is Poor, just above 0 is Intermediate, 1.25 is Normal, 2.25 is Normal, just above 2.25 is Ultrarapid', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-9, max: 0.5, noNaN: true }), d => {
        // R3
        expect(activityScoreToPhenotype(0)).toBe('Poor Metabolizer');
        expect(activityScoreToPhenotype(Number.MIN_VALUE)).toBe('Intermediate Metabolizer');
        // R4: 0 < AS < 1.25
        expect(activityScoreToPhenotype(d)).toBe('Intermediate Metabolizer');
        expect(activityScoreToPhenotype(1.25 - d)).toBe('Intermediate Metabolizer');
        // R5: 1.25 <= AS <= 2.25
        expect(activityScoreToPhenotype(1.25)).toBe('Normal Metabolizer');
        expect(activityScoreToPhenotype(1.25 + d)).toBe('Normal Metabolizer');
        expect(activityScoreToPhenotype(2.25 - d)).toBe('Normal Metabolizer');
        expect(activityScoreToPhenotype(2.25)).toBe('Normal Metabolizer');
        // R6: AS > 2.25
        expect(activityScoreToPhenotype(2.25 + d)).toBe('Ultrarapid Metabolizer');
        expect(activityScoreToPhenotype(Number.MAX_SAFE_INTEGER)).toBe('Ultrarapid Metabolizer');
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// 4. R7/R8: uninterpretable or missing genotype is GREY, never GREEN
// ---------------------------------------------------------------------------

describe('R7/R8 indeterminate or missing CYP2D6 result is GREY and never GREEN', () => {
  const drugArb = fc.constantFrom(...CYP2D6_DRUGS);

  it('R7 a genotype with an unknown allele (e.g. *999) is GREY, never GREEN, for codeine, tramadol and atomoxetine', () => {
    fc.assert(
      fc.property(indeterminateGenotype, anyMeds, drugArb, (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.alert).not.toBe('GREEN');
        expect(a.alert).toBe('GREY');
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('R8 a missing CYP2D6 result is GREY, never GREEN, for codeine, tramadol and atomoxetine', () => {
    fc.assert(
      fc.property(fc.constantFrom<string | undefined>(undefined, ''), anyMeds, drugArb, (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.alert).not.toBe('GREEN');
        expect(a.alert).toBe('GREY');
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// 5. R21: already a poor metabolizer + any inhibitor
// ---------------------------------------------------------------------------

describe('R21 poor metabolizer by genotype with an inhibitor: alert still fires, with the "adds no further effect" note', () => {
  const zeroGenotype = fc
    .tuple(fc.constantFrom(...ZERO_ALLELES), fc.constantFrom(...ZERO_ALLELES))
    .map(([a, b]) => `${a}/${b}`);

  // KNOWN FAILURE (expected, predicted from reading the code; this file could not be run when it
  // was written). Atomoxetine does not get the R21 note when the inhibitor is strong or moderate:
  //   - strong:   applyPhenoconversion returns the R17 branch before the R21 branch, so
  //               inhibitorNote is undefined (alert is RED/YELLOW, not GREEN or GREY).
  //   - moderate: applyPhenoconversion returns the "not computed" branch and checkOrder takes the
  //               R18 branch, so the alert is GREY "Not assessed" and there is no note. R18 itself
  //               says R21 applies when the genotype activity score is 0.
  // Expected shrunk counterexample, roughly:
  //   genotype "*100/*100" (first 0.0 allele in the CPIC data), meds ["bupropion"] (strong) or
  //   ["abiraterone"] (moderate), drug "atomoxetine".
  // Codeine and tramadol, and atomoxetine with weak inhibitors only, should pass.
  it('R21 AS 0 genotype + any inhibitor: never GREEN, never GREY, and the note contains "adds no further effect" (codeine, tramadol, atomoxetine)', () => {
    fc.assert(
      fc.property(zeroGenotype, medsWithInhibitor, fc.constantFrom(...CYP2D6_DRUGS), (genotype, meds, drug) => {
        const a = assessAdded(makePatient(genotype, meds), drug);
        expect(a.genotypeActivityScore).toBe(0);
        expect(a.alert).not.toBe('GREEN');
        expect(a.alert).not.toBe('GREY');
        expect(a.inhibitorNote ?? '').toContain('adds no further effect');
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
