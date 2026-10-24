// Fixtures test - all 22 synthetic test cases
// Compares engine output against expected_outputs.json

import { describe, it, expect } from 'vitest';
import { checkOrder } from './checkOrder';
import { toCdsCard, GREEN_ALERT_TEXT } from './cdsCard';
import type { Patient } from './types';
import expectedOutputs from '../../../tests/fixtures/expected_outputs.json';

describe('RxGene Engine - Fixture Tests', () => {
  expectedOutputs.forEach((fixture) => {
    it(`${fixture.id}: ${fixture.note}`, () => {
      // Build patient from fixture
      const patient: Patient = {
        id: fixture.id,
        name: fixture.id,
        cyp2d6: fixture.cyp2d6 || undefined,
        cyp2c19: fixture.cyp2c19 || undefined,
        meds: fixture.current_meds ? fixture.current_meds.split(',').map(m => m.trim()).filter(m => m) : []
      };

      // Run the engine
      const assessments = checkOrder(patient, fixture.new_drug);

      // Find the assessment for the alerted drug
      const assessment = assessments.find(a => a.drug === fixture.alerted_drug);

      // Should have an assessment for the alerted drug
      expect(assessment).toBeDefined();
      if (!assessment) return;

      // Test 1: Alert level
      expect(assessment.alert).toBe(fixture.alert);

      // Test 2: Genotype phenotype
      expect(assessment.genotypePhenotype).toBe(fixture.genotype_phenotype);

      // Test 3: Adjusted phenotype
      expect(assessment.adjustedPhenotype).toBe(fixture.adjusted_phenotype);

      // Test 4: CPIC recommendation (exact match)
      expect(assessment.recommendation).toBe(fixture.cpic_recommendation);

      // New curated fields (exact match when the fixture provides them).
      const fx = fixture as unknown as Record<string, string | undefined>;
      if (fx.genotype_recommendation) {
        expect(assessment.genotypeRecommendation).toBe(fx.genotype_recommendation);
      }
      if (fx.label_recommendation) {
        expect(assessment.labelRecommendation).toBe(fx.label_recommendation);
      }
      if (fx.discrepancy_flag) {
        expect(assessment.discrepancyFlag).toBe(fx.discrepancy_flag);
      }
      if (fx.cpic_role) {
        expect(assessment.cpicRole).toBe(fx.cpic_role);
      }

      // R30/R32/R33: a GREY alert must never reuse the GREEN disclaimer wording.
      if (assessment.alert === 'GREY') {
        expect(assessment.recommendation).not.toBe(GREEN_ALERT_TEXT);
        expect(assessment.recommendation).not.toContain('No supported PGx alert can be given');
      }

      // Test 5: Confidence
      if (fixture.confidence === 'reduced (UMs may not fully phenoconvert, CPIC 2023)') {
        expect(assessment.confidence).toBe('reduced');
      } else {
        expect(assessment.confidence).toBe('standard');
      }

      // Test 6: Inhibitor note (substring match if present in expected)
      if (fixture.inhibitor_note && fixture.inhibitor_note !== '') {
        expect(assessment.inhibitorNote).toBeDefined();
        expect(assessment.inhibitorNote).toContain(fixture.inhibitor_note.substring(0, 20));
      }

      // Additional validations for completeness
      
      // Check phenoconverted flag
      if (fixture.phenoconverted === 'yes') {
        expect(assessment.phenoconverted).toBe(true);
      } else if (fixture.phenoconverted === 'no') {
        expect(assessment.phenoconverted).toBe(false);
      }

      // Check activity scores if provided
      if (fixture.genotype_AS !== '' && fixture.genotype_AS !== 'n/a (CYP2C19 has no activity score)') {
        const expectedAS = parseFloat(fixture.genotype_AS as string);
        expect(assessment.genotypeActivityScore).toBeCloseTo(expectedAS, 2);
      }

      if (
        fixture.adjusted_AS !== '' &&
        fixture.adjusted_AS !== 'not computed' &&
        fixture.adjusted_AS !== 'n/a (CYP2C19 has no activity score)' &&
        !Number.isNaN(parseFloat(fixture.adjusted_AS as string))
      ) {
        const expectedAdjustedAS = parseFloat(fixture.adjusted_AS as string);
        expect(assessment.adjustedActivityScore).toBeCloseTo(expectedAdjustedAS, 2);
      }

      // R17: the label-based atomoxetine case reports a null adjusted score ("n/a").
      if (typeof fixture.adjusted_AS === 'string' && fixture.adjusted_AS.startsWith('n/a (label-based')) {
        expect(assessment.adjustedActivityScore).toBeNull();
      }

      // Check inhibitor detection
      if (fixture.inhibitor && fixture.inhibitor !== '') {
        const inhibitorMatch = fixture.inhibitor.match(/^(.+?)\s*\((\w+)\)$/);
        if (inhibitorMatch) {
          const [, drugName, strength] = inhibitorMatch;
          
          // Only check if it's not a weak inhibitor (weak don't set the inhibitor field)
          if (strength !== 'weak') {
            expect(assessment.inhibitor).toBeDefined();
            expect(assessment.inhibitor?.drug.toLowerCase()).toBe(drugName.toLowerCase());
            expect(assessment.inhibitor?.strength).toBe(strength);
          }
        }
      }

      // Check genotype if provided
      if (fixture.cyp2d6) {
        expect(assessment.genotype).toBe(fixture.cyp2d6);
      } else if (fixture.cyp2c19) {
        expect(assessment.genotype).toBe(fixture.cyp2c19);
      }

      // Check triggered by
      expect(assessment.triggeredBy).toBe(fixture.new_drug);

      // Check that source info is present
      expect(assessment.source).toBeDefined();
      expect(assessment.source.guideline).toBeTruthy();

      // For clopidogrel with omeprazole, check label note
      if (fixture.alerted_drug === 'clopidogrel' && fixture.current_meds.includes('omeprazole')) {
        expect(assessment.labelNote).toBeDefined();
        expect(assessment.labelNote).toContain('omeprazole');
      }

      // Test: Summary must be under 140 characters
      const card = toCdsCard(assessment);
      expect(card.summary.length).toBeLessThanOrEqual(140);
    });
  });

  // Additional test: reverse case (P12)
  it('P12 reverse case: adding inhibitor alerts existing drug', () => {
    const patient: Patient = {
      id: 'P12',
      name: 'P12',
      cyp2d6: '*1/*1',
      meds: ['codeine']
    };

    const assessments = checkOrder(patient, 'fluoxetine');

    // Should have assessment for codeine (already on list)
    const codeineAssessment = assessments.find(a => a.drug === 'codeine');
    expect(codeineAssessment).toBeDefined();
    expect(codeineAssessment?.alert).toBe('RED');
    expect(codeineAssessment?.triggeredBy).toBe('fluoxetine');
    expect(codeineAssessment?.phenoconverted).toBe(true);
  });

  // Test: multiple assessments can be returned
  it('Multiple drugs can be assessed in one call', () => {
    const patient: Patient = {
      id: 'test',
      name: 'test',
      cyp2d6: '*1/*1',
      meds: ['codeine', 'tramadol']
    };

    // Adding a strong inhibitor should alert both
    const assessments = checkOrder(patient, 'fluoxetine');

    expect(assessments.length).toBeGreaterThanOrEqual(2);
    
    const codeineAssessment = assessments.find(a => a.drug === 'codeine');
    const tramadolAssessment = assessments.find(a => a.drug === 'tramadol');
    
    expect(codeineAssessment).toBeDefined();
    expect(tramadolAssessment).toBeDefined();
    
    expect(codeineAssessment?.alert).toBe('RED');
    expect(tramadolAssessment?.alert).toBe('RED');
  });

  // Test: unsupported drugs don't create assessments
  it('Unsupported drugs return empty array', () => {
    const patient: Patient = {
      id: 'test',
      name: 'test',
      cyp2d6: '*1/*1',
      meds: []
    };

    const assessments = checkOrder(patient, 'aspirin');
    expect(assessments.length).toBe(0);
  });
});
