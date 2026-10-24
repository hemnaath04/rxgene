// Pure presentation mapping for the molecule stage (UI-only). Turns an engine assessment plus
// run flags into a conceptual pathway state and an output label. It never makes a clinical
// decision: it only reads fields the engine already produced (alert, adjustedPhenotype,
// phenoconverted, inhibitor, drug) and chooses how to illustrate them.
import type { FlowState } from '@/components/MoleculeStage';
import { speedOf } from '@/lib/verdict';
import type { ClearsSpeed } from '@/engine/templates';
import type { DrugAssessment } from '@/engine/types';

/** Drugs where CPIC states a phenoconversion rule and we animate metabolic throughput. */
const ANIMATED_DRUGS = new Set(['codeine', 'tramadol']);

/**
 * Conceptual pathway state for stage 02. Animated metabolic throughput (green pass / coral
 * block / constrained travel) is restricted to the supported, computed opioids codeine and
 * tramadol. Every other case is static. Neutral/guidance illustration never means the clinical
 * assessment is unavailable; stage 03 and the Evidence sheet always show the real engine result.
 *
 *  • idle        : not checked yet, or a check is pending (no stale animation).
 *  • notAssessed : GREY (not assessed / data error), uncomputed, or no readable phenotype.
 *  • guidance    : a supported, non-GREY drug with a real result we do NOT animate as
 *                  throughput — non-opioids (atomoxetine, clopidogrel) and any valid
 *                  non-speed phenotype (e.g. PM-equivalent dosing with a null adjusted score).
 *  • inhibited   : codeine/tramadol the engine phenoconverted via a STRONG inhibitor — the gate
 *                  is fully blocked. Moderate inhibitors never produce a full block.
 *  • reduced     : codeine/tramadol constrained — a moderate inhibitor lowered the score (even
 *                  if the phenotype stays Normal), a moderate-driven conversion, or an inherited
 *                  Slow/Reduced baseline. Sparse constrained travel, no full green throughput.
 *  • normal      : codeine/tramadol at full capacity with no lowering effect — green throughput.
 *
 * @param checked whether a result is on screen (level !== null)
 * @param pending whether a check is in flight (suppresses any flow until it resolves)
 */
export function flowStateFor(a: DrugAssessment | null, checked: boolean, pending = false): FlowState {
  if (!checked || pending) return 'idle';
  if (!a) return 'notAssessed';

  // Not assessed / data error (GREY) and uncomputed are neutral regardless of any phenotype.
  if (a.alert === 'GREY' || a.adjustedPhenotype === 'not computed') return 'notAssessed';

  const nowSpeed = speedOf(a.adjustedPhenotype);

  // Only the opioids with a CPIC phenoconversion rule get animated metabolic throughput.
  if (!ANIMATED_DRUGS.has(a.drug)) return 'guidance';

  // A supported opioid with a valid but non-speed phenotype (null adjusted score) is guidance.
  if (nowSpeed === null) return 'guidance';

  const strongConversion = a.phenoconverted === true && a.inhibitor?.strength === 'strong';
  if (strongConversion && (nowSpeed === 'Slow' || nowSpeed === 'Reduced')) return 'inhibited';

  // Any moderate inhibitor that lowered the score is constrained — even if still Normal.
  const moderateLowering =
    a.inhibitor?.strength === 'moderate' &&
    a.adjustedActivityScore !== null &&
    a.genotypeActivityScore !== null &&
    a.adjustedActivityScore < a.genotypeActivityScore;

  if (moderateLowering) return 'reduced';
  if (nowSpeed === 'Slow' || nowSpeed === 'Reduced') return 'reduced';
  return 'normal';
}

/** Whether the pathway shows moving particles (explicit Play is still required to start). */
export function isAnimatableFlow(flow: FlowState): boolean {
  return flow === 'normal' || flow === 'reduced' || flow === 'inhibited';
}

/**
 * Plain-language, directional output label for the pathway. Returns a neutral prompt/status for
 * idle/not-assessed/not-computed so the UI never implies a known output before there is one, and
 * source-specific descriptive text for the static 'guidance' drugs.
 */
export function outputLabelFor(drug: string, flow: FlowState, speed: ClearsSpeed | null, notComputed: boolean): string {
  if (flow === 'idle') return 'Check prescription to see the result';
  if (flow === 'notAssessed') return notComputed ? 'Not computed' : 'Not assessed';

  const lower = speed === 'Slow' || speed === 'Reduced';

  // Static guidance drugs: describe the engine's result without a metabolic-throughput claim.
  if (flow === 'guidance') {
    switch (drug) {
      case 'atomoxetine':
        return lower ? 'Reduced clearance — see dosing guidance' : 'See CPIC/label dosing guidance';
      case 'clopidogrel':
        return lower ? 'Reduced activation — see guidance' : 'Genotype-based guidance';
      default:
        return 'See dosing guidance';
    }
  }

  switch (drug) {
    case 'codeine':
      return lower ? 'Reduced morphine formation' : speed === 'Fast' ? 'More morphine formation' : 'Morphine formation';
    case 'tramadol':
      return lower ? 'Less active painkiller formed' : speed === 'Fast' ? 'More active painkiller formed' : 'Active painkiller formed';
    default:
      return speed ? 'Drug processing' : 'Effect not assessed';
  }
}
