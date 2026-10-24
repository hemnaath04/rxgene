// App state <-> URL query string: ?patient=&meds=&add=&mode=&lang=
// (architecture spec section 1, "Deep links"). All app state lives in the URL.
import { findPatient, patients, patientSlug, type PresetPatient } from '@/data/patients';

export type Mode = 'ehr' | 'local';
export type Lang = 'en' | 'es';

export const DEFAULT_MODE: Mode = 'ehr';
export const DEFAULT_LANG: Lang = 'en';

/** The raw query state, before it is matched against the preset patients. */
export type UrlState = {
  /** Lowercase name or ID as written in the URL; null if absent. */
  patient: string | null;
  /** Current medications (without the added drug); null if the param is absent. */
  meds: string[] | null;
  /** The drug being added. Adding it also runs the check. */
  add: string | null;
  mode: Mode;
  lang: Lang;
};

const normalizeDrug = (drug: string) => drug.trim().toLowerCase();

function uniqueDrugs(drugs: string[]): string[] {
  const out: string[] = [];
  for (const drug of drugs.map(normalizeDrug)) {
    if (drug && !out.includes(drug)) out.push(drug);
  }
  return out;
}

/** Parse a query string ("?patient=sarah&add=codeine"). Unknown values fall back to defaults. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const patient = params.get('patient')?.trim().toLowerCase() || null;
  const meds = params.get('meds');
  const add = normalizeDrug(params.get('add') ?? '') || null;
  const mode = params.get('mode')?.trim().toLowerCase() === 'local' ? 'local' : DEFAULT_MODE;
  const lang = params.get('lang')?.trim().toLowerCase() === 'es' ? 'es' : DEFAULT_LANG;
  return { patient, meds: meds === null ? null : uniqueDrugs(meds.split(',')), add, mode, lang };
}

/** Serialize to a query string. Medications stay comma-separated (commas are not escaped). */
export function serializeUrlState(state: UrlState): string {
  const enc = encodeURIComponent;
  const parts: string[] = [];
  if (state.patient) parts.push(`patient=${enc(state.patient)}`);
  if (state.meds) parts.push(`meds=${state.meds.map(enc).join(',')}`);
  if (state.add) parts.push(`add=${enc(state.add)}`);
  parts.push(`mode=${state.mode}`, `lang=${state.lang}`);
  return `?${parts.join('&')}`;
}

/** URL state matched against the presets: what the app starts with. */
export type ResolvedState = {
  patient: PresetPatient;
  /** Current medications, without the added drug. */
  meds: string[];
  add: string | null;
  mode: Mode;
  lang: Lang;
};

/**
 * Match ?patient= by lowercase name or ID (unknown -> first preset). Without ?meds=,
 * the preset's medication list is used. The added drug is never also a current med.
 */
export function resolveUrlState(state: UrlState): ResolvedState {
  const patient = (state.patient && findPatient(state.patient)) || patients[0];
  const meds = uniqueDrugs(state.meds ?? patient.meds).filter(m => m !== state.add);
  return { patient, meds, add: state.add, mode: state.mode, lang: state.lang };
}

/** App state -> URL state. Always writes the patient's lowercase name, never the ID. */
export function toUrlState(app: {
  patient: PresetPatient;
  /** The full medication list shown in the UI (may include the added drug). */
  meds: string[];
  add: string | null;
  mode: Mode;
  lang: Lang;
}): UrlState {
  return {
    patient: patientSlug(app.patient),
    meds: uniqueDrugs(app.meds).filter(m => m !== app.add),
    add: app.add,
    mode: app.mode,
    lang: app.lang
  };
}

export function readUrlState(): UrlState {
  return parseUrlState(window.location.search);
}

/** Replace (not push) the current history entry, so state changes don't flood Back. */
export function writeUrlState(state: UrlState): void {
  const search = serializeUrlState(state);
  if (search === window.location.search) return;
  const { pathname, hash } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`);
}
