// Explicit, hand-written demo fixtures for the UI-only standalone view. NO engine, NO network,
// NO clinical computation — these are fixed presentation view-models that reproduce known
// synthetic cases for the demo. A real backend replaces this adapter entirely by supplying its
// own RxGeneResult. Fixtures are clearly labelled; the visible "SYNTHETIC DEMO" chip covers the
// user-facing disclosure. Green flow is illustrative processing, never a clinical "safe".
import type { RxGeneResult, SelectOption } from '@/ui/types';

export const PATIENT_OPTIONS: SelectOption[] = [
  { value: 'sarah', label: 'Sarah · P01', detail: 'CYP2D6 *1/*1' },
  { value: 'priya', label: 'Priya · P03', detail: 'CYP2D6 *1/*1' },
];

export const MEDICATION_OPTIONS: SelectOption[] = [
  { value: 'fluoxetine', label: 'Fluoxetine' },
  { value: 'paroxetine', label: 'Paroxetine' },
  { value: 'bupropion', label: 'Bupropion' },
  { value: 'omeprazole', label: 'Omeprazole' },
];

export const PRESCRIPTION_OPTIONS: SelectOption[] = [
  { value: 'codeine', label: 'Codeine' },
  { value: 'tramadol', label: 'Tramadol' },
  { value: 'atomoxetine', label: 'Atomoxetine' },
  { value: 'clopidogrel', label: 'Clopidogrel' },
];

/** The exact default screenshot: Sarah · Fluoxetine · Codeine → Slow · Avoid codeine. */
export const SARAH_INHIBITED: RxGeneResult = {
  gene: 'CYP2D6',
  diplotype: '*1/*1',
  baselineLabel: 'Normal by genes',
  baselineSpeed: 'Normal',
  drugLabel: 'Codeine',
  currentSpeed: 'Slow',
  currentLabel: 'Slow',
  scoreBefore: '2.0',
  scoreAfter: '0',
  scoreNote: 'Rule-adjusted',
  outputLabel: 'Reduced morphine formation',
  flowState: 'inhibited',
  inhibitor: { drug: 'Fluoxetine', strengthLabel: 'Strong inhibitor' },
  caption: 'Fluoxetine reduces CYP2D6 activity. Sarah\u2019s genes are unchanged.',
  verdict: {
    level: 'RED',
    kicker: 'Prescription review',
    headline: 'Avoid codeine.',
    rationale: 'Codeine likely won\u2019t relieve pain for this patient. Consider an alternative.',
    source: 'CPIC Opioids · 2021 · Strong recommendation',
    explanationAvailable: true,
  },
  evidenceTitle: 'Codeine · Avoid codeine',
  evidenceBody:
    'By genes: Normal (activity score 2.0). With current medications: Poor (activity score 0). ' +
    'Fluoxetine is a strong CYP2D6 inhibitor (FDA table); CPIC Opioids 2021 maps a strong ' +
    'inhibitor to a poor-metabolizer equivalent for codeine. Recommendation (CPIC, verbatim): ' +
    '\u201cAvoid codeine use because of potential for diminished analgesia. If opioid use is ' +
    'warranted, consider a non-tramadol opioid.\u201d',
  sourceLinks: [
    { label: 'CPIC Opioids guideline (2021)', url: 'https://cpicpgx.org/guidelines/cpic-guideline-for-codeine-and-cyp2d6/' },
    { label: 'FDA CYP inhibitor examples', url: 'https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems' },
  ],
  explanationTitle: 'For the patient',
  explanationBody:
    'Your genes clear this medicine normally, but another medicine you take (fluoxetine) slows ' +
    'the enzyme that turns codeine into its active pain reliever. Right now your body acts slow ' +
    'for codeine, so it may not relieve pain well. Your care team will talk with you about other ' +
    'options.',
};

/** Priya · no inhibitor · Codeine → Normal, illustrative green throughput, no supported alert. */
export const PRIYA_NORMAL: RxGeneResult = {
  gene: 'CYP2D6',
  diplotype: '*1/*1',
  baselineLabel: 'Normal by genes',
  baselineSpeed: 'Normal',
  drugLabel: 'Codeine',
  currentSpeed: 'Normal',
  currentLabel: 'Normal',
  scoreBefore: '2.0',
  scoreAfter: '2.0',
  scoreNote: 'Same as genes',
  outputLabel: 'Morphine formation',
  flowState: 'normal',
  inhibitor: null,
  caption: 'No CYP2D6 inhibitor on the medication list. Priya\u2019s genes are unchanged.',
  verdict: {
    level: 'GREEN',
    kicker: 'Prescription review',
    headline: 'No supported alert',
    qualifier: '(not the same as safe)',
    rationale: 'RxGene has no guideline-backed flag for codeine with this gene result and medication list.',
    source: 'CPIC Opioids · 2021',
    explanationAvailable: true,
  },
  evidenceTitle: 'Codeine · No supported alert',
  evidenceBody:
    'By genes: Normal (activity score 2.0). With current medications: Normal (activity score 2.0). ' +
    'No strong or moderate CYP2D6 inhibitor on the list. GREEN means no supported PGx alert \u2014 ' +
    'this is not the same as safe.',
  sourceLinks: [{ label: 'CPIC Opioids guideline (2021)', url: 'https://cpicpgx.org/guidelines/cpic-guideline-for-codeine-and-cyp2d6/' }],
  explanationTitle: 'For the patient',
  explanationBody:
    'For codeine, your gene result does not call for a change, and nothing on your medication list ' +
    'changes it. RxGene has no supported alert for this drug. That is not the same as safe. Keep ' +
    'following your prescriber\u2019s advice.',
};

/** Neutral preview for a combination we have no fixture for — never invents dosing. */
export function notAssessedPreview(drugLabel: string): RxGeneResult {
  return {
    gene: 'CYP2D6',
    diplotype: '*1/*1',
    baselineLabel: 'Normal by genes',
    baselineSpeed: 'Normal',
    drugLabel,
    currentSpeed: null,
    currentLabel: 'Not assessed',
    scoreBefore: null,
    scoreAfter: null,
    scoreNote: null,
    outputLabel: 'Not assessed',
    flowState: 'notAssessed',
    inhibitor: null,
    caption: 'This combination is not part of the synthetic demo. Connect the backend for a real assessment.',
    verdict: {
      level: 'GREY',
      kicker: 'Prescription review',
      headline: 'Not assessed',
      rationale: 'No demo fixture for this combination. The backend will provide the assessment.',
      source: undefined,
      explanationAvailable: false,
    },
    evidenceTitle: `${drugLabel} · Not assessed`,
    evidenceBody: 'No synthetic fixture matches this patient / medication / prescription combination.',
    sourceLinks: [],
  };
}
