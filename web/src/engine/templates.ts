// Fixed plain-language patient summaries (build spec section 6, R31/R33/R36).
// Used when the AI summary is unavailable or fails validation, and as the browser fallback.
// Imported by both the browser and web/api/*: no Node imports, relative imports only.
//
// Wording rules:
// - RED keeps an avoid / not-recommended meaning. YELLOW names the dosing pathway and never
//   says avoid. GREEN uses "not the same as safe". GREY says not assessed / pharmacist.
// - Never describe anything as safe / seguro (R33). The only allowed phrase is
//   "not the same as safe" / "no es lo mismo que seguro".
// - No numbers unless they come from the assessment (the templates use none).

import type { DrugAssessment } from './types';

export type SummaryLang = 'en' | 'es';

/** The only permitted uses of "safe" / "seguro" (R31, R33). */
export const NOT_SAME_AS_SAFE: Record<SummaryLang, string> = {
  en: 'not the same as safe',
  es: 'no es lo mismo que seguro',
};

/** Spanish generic names for the drugs RxGene covers or lists as inhibitors. */
export const DRUG_NAMES_ES: Record<string, string> = {
  codeine: 'codeína',
  tramadol: 'tramadol',
  atomoxetine: 'atomoxetina',
  clopidogrel: 'clopidogrel',
  fluoxetine: 'fluoxetina',
  paroxetine: 'paroxetina',
  bupropion: 'bupropión',
  quinidine: 'quinidina',
  terbinafine: 'terbinafina',
  abiraterone: 'abiraterona',
  cinacalcet: 'cinacalcet',
  duloxetine: 'duloxetina',
  lorcaserin: 'lorcaserina',
  mirabegron: 'mirabegrón',
  rolapitant: 'rolapitant',
  amiodarone: 'amiodarona',
  celecoxib: 'celecoxib',
  clobazam: 'clobazam',
  cimetidine: 'cimetidina',
  cobicistat: 'cobicistat',
  escitalopram: 'escitalopram',
  fluvoxamine: 'fluvoxamina',
  labetalol: 'labetalol',
  sertraline: 'sertralina',
  vemurafenib: 'vemurafenib',
  omeprazole: 'omeprazol',
  prasugrel: 'prasugrel',
  ticagrelor: 'ticagrelor',
};

/** Drug name in the summary language (falls back to the name as given). */
export function drugName(drug: string, lang: SummaryLang): string {
  return lang === 'es' ? (DRUG_NAMES_ES[drug.toLowerCase()] ?? drug) : drug;
}

export type ClearsSpeed = 'Slow' | 'Reduced' | 'Normal' | 'Fast';

/** Phenotype -> "Clears this drug: ..." scale (docs/PLAN-v3.md "UI language"). */
export function clearsThisDrug(phenotype: string): ClearsSpeed | null {
  if (phenotype.startsWith('Poor')) return 'Slow';
  if (phenotype.startsWith('Intermediate') || phenotype.startsWith('Likely Intermediate')) return 'Reduced';
  if (phenotype.startsWith('Normal')) return 'Normal';
  if (phenotype.startsWith('Ultrarapid') || phenotype.startsWith('Rapid')) return 'Fast';
  return null;
}

const SPEED_ES: Record<ClearsSpeed, string> = {
  Slow: 'Lento',
  Reduced: 'Reducido',
  Normal: 'Normal',
  Fast: 'Rápido',
};

const speedWord = (speed: ClearsSpeed, lang: SummaryLang) => (lang === 'es' ? SPEED_ES[speed] : speed);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Prefix of the engine's "already a poor metabolizer" inhibitorNote (phenoconversion.ts). */
const ALREADY_PM_MARKER = ' adds no further effect';

// ---- Sentences per alert level ----

function redSentences(a: DrugAssessment, lang: SummaryLang): string[] {
  const d = drugName(a.drug, lang);
  const rec = a.recommendation.toLowerCase();
  const pain = rec.includes('diminished analgesia');
  const toxicity = rec.includes('toxicity');

  if (lang === 'es') {
    return [
      `No se recomienda ${d} para usted en este momento. La guía indica evitarlo.`,
      ...(pain ? ['Puede no funcionar para aliviar su dolor.'] : []),
      ...(toxicity ? ['Podría causar efectos secundarios graves.'] : []),
    ];
  }
  return [
    `${capitalize(d)} is not recommended for you right now. The guideline says to avoid it.`,
    ...(pain ? ['It may not work to relieve your pain.'] : []),
    ...(toxicity ? ['It could cause serious side effects.'] : []),
  ];
}

function yellowSentences(a: DrugAssessment, lang: SummaryLang): string[] {
  const d = drugName(a.drug, lang);
  const rec = a.recommendation.toLowerCase();
  const titration = rec.includes('initiate') || rec.includes('increase') || rec.includes('titrat');
  const ifNoResponse = rec.includes('if no response') || rec.includes('if no clinical response');

  if (lang === 'es') {
    return [
      `Para ${d}, la guía indica un plan de dosis específico para usted.`,
      ...(titration ? ['Su médico puede ajustar la dosis paso a paso.'] : []),
      ...(ifNoResponse ? ['Si no le ayuda lo suficiente, se puede considerar otro medicamento.'] : []),
      'No cambie la forma de tomarlo por su cuenta.',
    ];
  }
  return [
    `For ${d}, the guideline gives a specific dosing plan for you.`,
    ...(titration ? ['Your prescriber may adjust the dose step by step.'] : []),
    ...(ifNoResponse ? ['If it does not help enough, another medicine may be considered.'] : []),
    'Do not change how you take it on your own.',
  ];
}

function greenSentences(a: DrugAssessment, lang: SummaryLang): string[] {
  const d = drugName(a.drug, lang);
  if (lang === 'es') {
    return [
      `Para ${d}, su resultado genético no indica ningún cambio.`,
      `RxGene no tiene una alerta respaldada para este medicamento. Esto ${NOT_SAME_AS_SAFE.es}.`,
      'Siga los consejos de su médico.',
    ];
  }
  return [
    `For ${d}, your gene result does not call for a change.`,
    `RxGene has no supported alert for this drug. That is ${NOT_SAME_AS_SAFE.en}.`,
    "Keep following your prescriber's advice.",
  ];
}

function greySentences(a: DrugAssessment, lang: SummaryLang): string[] {
  const d = drugName(a.drug, lang);
  if (a.adjustedPhenotype === 'not computed') {
    return lang === 'es'
      ? [
          `Otro medicamento que usted toma puede cambiar cómo funciona ${d}, y RxGene no puede calcularlo.`,
          'Un farmacéutico lo revisará.',
        ]
      : [
          `Another medicine you take may change how ${d} works, and RxGene cannot work this out.`,
          'A pharmacist will review it.',
        ];
  }
  return lang === 'es'
    ? [
        `No se evaluó ${d}. RxGene no pudo compararlo con su resultado genético.`,
        'Pida a su farmacéutico que lo revise.',
      ]
    : [
        `${capitalize(d)} was not assessed. RxGene could not check it against your gene result.`,
        'Please ask your pharmacist to review it.',
      ];
}

// ---- Optional sentences ----

/** "Cleanup crew" + "Clears this drug" + phenoconversion. Only when the speeds are known. */
function crewSentences(a: DrugAssessment, lang: SummaryLang): string[] {
  if (a.alert === 'GREY') return [];
  const now = clearsThisDrug(a.adjustedPhenotype);
  if (!now) return [];

  const out: string[] =
    lang === 'es'
      ? ['Su hígado tiene un equipo de limpieza para los medicamentos.']
      : ['Your liver has a cleanup crew for medicines.'];

  const byGenes = clearsThisDrug(a.genotypePhenotype);
  if (a.phenoconverted && a.inhibitor && byGenes) {
    const inh = drugName(a.inhibitor.drug, lang);
    out.push(
      lang === 'es'
        ? `Otro medicamento, ${inh}, frena a este equipo. Según sus genes: ${speedWord(byGenes, lang).toLowerCase()}. Ahora mismo, con sus medicamentos: ${speedWord(now, lang).toLowerCase()}.`
        : `Another medicine, ${inh}, jams this crew. Your genes say ${speedWord(byGenes, lang).toLowerCase()}, but right now your body acts ${speedWord(now, lang).toLowerCase()}.`
    );
  }

  out.push(lang === 'es' ? `Elimina este medicamento: ${speedWord(now, lang)}.` : `Clears this drug: ${speedWord(now, lang)}.`);
  return out;
}

function confidenceSentence(a: DrugAssessment, lang: SummaryLang): string[] {
  if (a.confidence !== 'reduced') return [];
  return lang === 'es'
    ? ['Con un equipo de limpieza rápido, este resultado es menos cierto.']
    : ['With a fast cleanup crew, this result is less certain.'];
}

function inhibitorNoteSentence(a: DrugAssessment, lang: SummaryLang): string[] {
  const note = a.inhibitorNote;
  if (!note) return [];

  const markerAt = note.indexOf(ALREADY_PM_MARKER);
  if (markerAt > 0) {
    const inh = drugName(note.slice(0, markerAt), lang);
    return lang === 'es'
      ? [`${capitalize(inh)} no cambia este resultado, porque su equipo de limpieza ya era lento.`]
      : [`${capitalize(inh)} does not change this result, because your cleanup crew was already slow.`];
  }
  if (note.startsWith('Weak')) {
    return lang === 'es'
      ? ['También toma un medicamento que frena al equipo solo un poco. Eso no basta para cambiar este resultado.']
      : ['You also take a medicine that slows the crew only a little. That is not enough to change this result.'];
  }
  // R20 caveat (ultrarapid may not fully phenoconvert): the confidence sentence already covers
  // the uncertainty for the patient, so this note is not repeated here.
  if (note.startsWith('Caveat')) {
    return [];
  }
  // Unrecognized note: no translation available, so point to the clinician.
  return lang === 'es'
    ? ['Su farmacéutico tiene una nota adicional sobre sus medicamentos.']
    : ['Your pharmacist has an extra note about your medicines.'];
}

function closingSentence(a: DrugAssessment, lang: SummaryLang): string[] {
  if (a.alert !== 'RED') return [];
  return lang === 'es'
    ? ['Su equipo de atención hablará con usted sobre otras opciones.']
    : ['Your care team will talk with you about other options.'];
}

/**
 * Fixed plain-language summary for one assessment. Deterministic: depends only on the
 * engine's output. Never decides anything.
 */
export function renderTemplate(assessment: DrugAssessment, lang: SummaryLang): string {
  const main =
    assessment.alert === 'RED'
      ? redSentences(assessment, lang)
      : assessment.alert === 'YELLOW'
        ? yellowSentences(assessment, lang)
        : assessment.alert === 'GREEN'
          ? greenSentences(assessment, lang)
          : greySentences(assessment, lang);

  return [
    ...main,
    ...crewSentences(assessment, lang),
    ...inhibitorNoteSentence(assessment, lang),
    ...confidenceSentence(assessment, lang),
    ...closingSentence(assessment, lang),
  ].join(' ');
}
