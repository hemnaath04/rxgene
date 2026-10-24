import { describe, it, expect } from 'vitest';
import { flowStateFor, isAnimatableFlow, outputLabelFor } from './moleculeFlow';
import type { DrugAssessment } from '@/engine/types';

/** Minimal assessment builder for presentation-state tests (not a clinical fixture). */
function make(partial: Partial<DrugAssessment>): DrugAssessment {
  return {
    drug: 'codeine',
    triggeredBy: 'codeine',
    gene: 'CYP2D6',
    genotype: '*1/*1',
    genotypeActivityScore: 2,
    genotypePhenotype: 'Normal Metabolizer',
    inhibitor: null,
    adjustedActivityScore: 2,
    adjustedPhenotype: 'Normal Metabolizer',
    phenoconverted: false,
    confidence: 'standard',
    alert: 'GREEN',
    recommendation: '',
    strength: '',
    source: { guideline: '', url: '', fetched: '' },
    ...partial,
  };
}

describe('flowStateFor', () => {
  it('is idle before a check regardless of assessment', () => {
    expect(flowStateFor(null, false)).toBe('idle');
    expect(flowStateFor(make({}), false)).toBe('idle');
  });

  it('is idle (neutral) while a check is pending, even with stale cards present', () => {
    // A mappable Normal opioid result would normally animate, but pending suppresses all flow.
    expect(flowStateFor(make({ drug: 'codeine', adjustedPhenotype: 'Normal Metabolizer' }), true, true)).toBe('idle');
  });

  it('is notAssessed when checked with no assessment or an uncomputed one', () => {
    expect(flowStateFor(null, true)).toBe('notAssessed');
    expect(flowStateFor(make({ adjustedPhenotype: 'not computed' }), true)).toBe('notAssessed');
    expect(flowStateFor(make({ adjustedPhenotype: 'Indeterminate' }), true)).toBe('notAssessed');
  });

  it('returns notAssessed for a GREY alert even when the phenotype is mappable (Normal)', () => {
    // Data error / not assessed must never animate green throughput off a readable phenotype.
    const grey = make({ drug: 'codeine', alert: 'GREY', adjustedPhenotype: 'Normal Metabolizer' });
    expect(flowStateFor(grey, true)).toBe('notAssessed');
  });

  // --- Animated metabolic throughput is restricted to codeine/tramadol ---

  it('animates codeine/tramadol only; other supported drugs are static guidance', () => {
    expect(flowStateFor(make({ drug: 'codeine', adjustedPhenotype: 'Normal Metabolizer' }), true)).toBe('normal');
    expect(flowStateFor(make({ drug: 'tramadol', adjustedPhenotype: 'Normal Metabolizer' }), true)).toBe('normal');

    // Atomoxetine with a readable result is guidance, not animated throughput.
    expect(flowStateFor(make({ drug: 'atomoxetine', gene: 'CYP2D6', adjustedPhenotype: 'Normal Metabolizer' }), true)).toBe(
      'guidance'
    );
    // Clopidogrel (CYP2C19) is genotype-only guidance, never animated inhibition.
    expect(flowStateFor(make({ drug: 'clopidogrel', gene: 'CYP2C19', adjustedPhenotype: 'Poor Metabolizer' }), true)).toBe(
      'guidance'
    );
  });

  it('maps a valid non-GREY opioid result with a non-speed phenotype to guidance (not notAssessed)', () => {
    // e.g. a correctly-sourced PM-equivalent dosing label with a null adjusted score.
    const nonSpeed = make({
      drug: 'codeine',
      alert: 'YELLOW',
      adjustedPhenotype: 'Poor-metabolizer-equivalent dosing (FDA label)',
      adjustedActivityScore: null,
    });
    expect(flowStateFor(nonSpeed, true)).toBe('guidance');
  });

  it('is inhibited ONLY for a supported opioid phenoconverted by a STRONG inhibitor', () => {
    const converted = make({
      drug: 'codeine',
      phenoconverted: true,
      adjustedPhenotype: 'Poor Metabolizer',
      genotypeActivityScore: 2,
      adjustedActivityScore: 0,
      inhibitor: { drug: 'fluoxetine', strength: 'strong' },
    });
    expect(flowStateFor(converted, true)).toBe('inhibited');
  });

  it('never shows a full block for a MODERATE inhibitor, even if it drove a conversion', () => {
    const moderateConversion = make({
      drug: 'codeine',
      phenoconverted: true,
      adjustedPhenotype: 'Intermediate Metabolizer', // maps to Reduced
      genotypeActivityScore: 2,
      adjustedActivityScore: 1,
      inhibitor: { drug: 'duloxetine', strength: 'moderate' },
    });
    expect(flowStateFor(moderateConversion, true)).toBe('reduced');
  });

  it('does not treat a non-phenoconverted inhibitor as a gate block (weak inhibitor)', () => {
    const weak = make({
      drug: 'codeine',
      phenoconverted: false,
      adjustedPhenotype: 'Normal Metabolizer',
      inhibitor: { drug: 'cimetidine', strength: 'weak' },
    });
    expect(flowStateFor(weak, true)).toBe('normal');
  });

  it('treats a moderate inhibitor that lowers the score as reduced even if the phenotype stays Normal', () => {
    const moderateWithinNormal = make({
      drug: 'codeine',
      phenoconverted: false,
      adjustedPhenotype: 'Normal Metabolizer',
      genotypeActivityScore: 2,
      adjustedActivityScore: 1.5, // lowered but still Normal
      inhibitor: { drug: 'duloxetine', strength: 'moderate' },
    });
    expect(flowStateFor(moderateWithinNormal, true)).toBe('reduced');
  });

  it('represents a moderate inhibitor that lands in Reduced as constrained (reduced)', () => {
    const moderate = make({
      drug: 'codeine',
      phenoconverted: false,
      adjustedPhenotype: 'Intermediate Metabolizer',
      genotypeActivityScore: 1.5,
      adjustedActivityScore: 0.75,
      inhibitor: { drug: 'duloxetine', strength: 'moderate' },
    });
    expect(flowStateFor(moderate, true)).toBe('reduced');
  });

  it('shows already-slow baseline as reduced (constrained), not inhibited', () => {
    const alreadySlow = make({ drug: 'codeine', phenoconverted: false, adjustedPhenotype: 'Poor Metabolizer' });
    expect(flowStateFor(alreadySlow, true)).toBe('reduced');
  });

  it('is normal for full-capacity opioid results', () => {
    expect(flowStateFor(make({ drug: 'codeine', adjustedPhenotype: 'Normal Metabolizer' }), true)).toBe('normal');
    expect(flowStateFor(make({ drug: 'codeine', adjustedPhenotype: 'Ultrarapid Metabolizer' }), true)).toBe('normal');
  });
});

describe('isAnimatableFlow', () => {
  it('animates only normal/reduced/inhibited; never idle/notAssessed/guidance', () => {
    expect(isAnimatableFlow('normal')).toBe(true);
    expect(isAnimatableFlow('reduced')).toBe(true);
    expect(isAnimatableFlow('inhibited')).toBe(true);
    expect(isAnimatableFlow('idle')).toBe(false);
    expect(isAnimatableFlow('notAssessed')).toBe(false);
    expect(isAnimatableFlow('guidance')).toBe(false);
  });
});

describe('outputLabelFor', () => {
  it('shows a neutral prompt before a check and status for not-assessed', () => {
    expect(outputLabelFor('codeine', 'idle', null, false)).toBe('Check prescription to see the result');
    expect(outputLabelFor('codeine', 'notAssessed', null, false)).toBe('Not assessed');
    expect(outputLabelFor('atomoxetine', 'notAssessed', null, true)).toBe('Not computed');
  });

  it('never implies morphine formation for an unchecked/uncomputed codeine case', () => {
    expect(outputLabelFor('codeine', 'idle', 'Normal', false)).not.toMatch(/morphine/i);
    expect(outputLabelFor('codeine', 'notAssessed', null, false)).not.toMatch(/morphine/i);
  });

  it('gives source-specific guidance text for static guidance drugs (no throughput claim)', () => {
    expect(outputLabelFor('atomoxetine', 'guidance', 'Normal', false)).toMatch(/guidance/i);
    expect(outputLabelFor('clopidogrel', 'guidance', 'Slow', false)).toMatch(/guidance/i);
    // Atomoxetine guidance never asserts morphine or a numeric multiplier.
    expect(outputLabelFor('atomoxetine', 'guidance', 'Normal', false)).not.toMatch(/morphine|\d/);
  });

  it('gives directional output for computed opioid results', () => {
    expect(outputLabelFor('codeine', 'inhibited', 'Slow', false)).toBe('Reduced morphine formation');
    expect(outputLabelFor('codeine', 'normal', 'Normal', false)).toBe('Morphine formation');
  });
});
