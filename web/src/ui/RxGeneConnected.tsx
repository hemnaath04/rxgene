// Real stateful adapter for the RxGeneUI desktop presentation component. Owns all state and
// reuses ConnectedApp's logic verbatim (patients, URL state, cdsClient/checkOrder, chips,
// consult POST with a stale-response guard): this file does not re-derive any clinical rule,
// it only wires the existing engine/lib functions into RxGeneUI's props and the existing
// EvidenceSheet / PatientExplanationSheet / ConsultSheet.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ConsultSheet, type ConsultNote, type TraceEntry } from '@/components/ConsultSheet';
import { EvidenceSheet } from '@/components/EvidenceSheet';
import { PatientExplanationSheet } from '@/components/PatientExplanationSheet';
import { findPatient, patients, type PresetPatient } from '@/data/patients';
import { checkOrder } from '@/engine';
import type { DrugAssessment } from '@/engine/types';
import { entryDrug, cdsEntries, localEntries, type CardEntry } from '@/lib/cardEntries';
import { buildRequest, send, type CdsExchange, type OrderSelectRequest } from '@/lib/cdsClient';
import { drugCatalog } from '@/lib/drugCatalog';
import { readUrlState, resolveUrlState, toUrlState, writeUrlState, type Mode } from '@/lib/url';
import { sortBySeverity } from '@/lib/verdict';
import { fetchConsult, type ConsultAgentResult } from '@/ui/consultFetch';
import { toRxGeneResult } from '@/ui/mapAssessment';
import { RxGeneUI } from '@/ui/RxGeneUI';
import type { SelectOption } from '@/ui/types';

type Exchange = { request: OrderSelectRequest; result: CdsExchange | null };

const PATIENT_OPTIONS: SelectOption[] = patients.map(p => ({
  value: p.id,
  label: `${p.name} \u00b7 ${p.id}`,
  detail: [p.cyp2d6 ? `CYP2D6 ${p.cyp2d6}` : null, p.cyp2c19 ? `CYP2C19 ${p.cyp2c19}` : null].filter(Boolean).join(' \u00b7 ') || 'no gene result',
}));

const MEDICATION_OPTIONS: SelectOption[] = drugCatalog.map(d => ({
  value: d.name,
  label: d.name.charAt(0).toUpperCase() + d.name.slice(1),
  detail: d.detail,
}));

const PRESCRIPTION_OPTIONS: SelectOption[] = drugCatalog.map(d => ({
  value: d.name,
  label: d.name.charAt(0).toUpperCase() + d.name.slice(1),
  detail: d.detail,
}));

/**
 * Build the consult sheet's note/trace from the agent response, or null while there is
 * nothing to show yet. Pass-through only: the ConsultSheet component renders it.
 */
function toConsultViewModel(result: ConsultAgentResult | null): { note: ConsultNote; trace: TraceEntry[] } | null {
  if (!result) return null;
  return { note: result.note, trace: result.trace };
}

export default function RxGeneConnected() {
  // URL -> initial state, once. ?add= both adds the drug and runs the check (below).
  const [initial] = useState(() => resolveUrlState(readUrlState()));
  const [patientId, setPatientId] = useState(initial.patient.id);
  const [meds, setMeds] = useState<string[]>(() => (initial.add ? [...initial.meds, initial.add] : initial.meds));
  const [added, setAdded] = useState<string | null>(initial.add);
  const [prescription, setPrescription] = useState<string>(initial.add ?? initial.patient.demoDrug);
  const [mode] = useState<Mode>(initial.mode);
  const [lang] = useState(initial.lang);
  const [cards, setCards] = useState<CardEntry[]>([]);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [pending, setPending] = useState(0);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [evidenceKey, setEvidenceKey] = useState<string | null>(null);
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultResult, setConsultResult] = useState<ConsultAgentResult | null>(null);
  const [consultLoading, setConsultLoading] = useState(false);
  const [consultError, setConsultError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const reduceMotion = !!useReducedMotion();

  // Results (check and consult) that arrive after the patient/meds changed are dropped.
  const epochRef = useRef(0);
  const consultEpochRef = useRef(0);
  const medsRef = useRef(meds);
  const bootedRef = useRef(false);

  const patient = findPatient(patientId) ?? patients[0];
  const currentMeds = added ? meds.filter(m => m !== added) : meds;

  useEffect(() => {
    writeUrlState(toUrlState({ patient, meds, add: added, mode, lang }));
  }, [patient, meds, added, mode, lang]);

  const mergeCards = useCallback((fresh: CardEntry[]) => {
    const freshDrugs = new Set(fresh.map(entryDrug));
    setCards(prev => [...fresh, ...prev.filter(c => !freshDrugs.has(entryDrug(c)))]);
  }, []);

  /** Check `drug` against `currentMeds` (the list before it was added). EHR mode with local fallback. */
  const runCheck = useCallback(
    async (p: PresetPatient, currentMeds: string[], drug: string, checkMode: Mode) => {
      const local = () => checkOrder({ ...p, meds: currentMeds }, drug);

      if (checkMode === 'local') {
        mergeCards(localEntries(drug, local(), 'local'));
        setExchange(null);
        return;
      }

      const epoch = epochRef.current;
      const request = buildRequest(p, currentMeds, drug);
      setExchange({ request, result: null });
      setPending(n => n + 1);
      const result = await send(request);
      setPending(n => n - 1);
      if (epochRef.current !== epoch || !medsRef.current.includes(drug)) return;

      setExchange(prev => (prev?.request === request ? { request, result } : prev));
      const assessments = local();
      if (result.ok) {
        mergeCards(cdsEntries(drug, result.response.cards, assessments));
      } else {
        mergeCards(localEntries(drug, assessments, 'local-fallback'));
      }
    },
    [mergeCards]
  );

  // Deep link (/?patient=sarah&add=codeine): run the check on first load.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (initial.add) void runCheck(initial.patient, initial.meds, initial.add, initial.mode);
  }, [initial, runCheck]);

  const resetResults = () => {
    epochRef.current++;
    consultEpochRef.current++;
    setCards([]);
    setExchange(null);
    setEvidenceKey(null);
    setConsultOpen(false);
    setConsultResult(null);
    setConsultError(null);
  };

  const updateMeds = (next: string[]) => {
    medsRef.current = next;
    setMeds(next);
  };

  const selectPatient = (id: string) => {
    const next = findPatient(id);
    if (!next) return;
    resetResults();
    setPatientId(next.id);
    updateMeds([...next.meds]);
    setAdded(null);
    setPrescription(next.demoDrug);
    setPlaying(false);
  };

  /** "Check prescription": the selected drug replaces any earlier prescription and is checked. */
  const checkPrescription = () => {
    const drug = prescription.toLowerCase();
    const current = meds.filter(m => m !== added && m.toLowerCase() !== drug);
    resetResults();
    updateMeds([...current, drug]);
    setAdded(drug);
    void runCheck(patient, current, drug, mode);
    setPlaying(true);
  };

  /** After a check, editing the chips re-runs it at once. */
  const recheck = (current: string[]) => {
    if (!added) return;
    epochRef.current++;
    consultEpochRef.current++;
    setConsultOpen(false);
    setConsultResult(null);
    setConsultError(null);
    void runCheck(patient, current, added, mode);
  };

  /** All current medications, shown as chips, can be added or removed (MedicationField gives one value at a time). */
  const onMedicationsChange = (values: string[]) => {
    const next = values.map(v => v.toLowerCase());
    const removed = currentMeds.filter(m => !next.includes(m));
    const addedChips = next.filter(m => !currentMeds.includes(m));

    let nextCurrent = currentMeds;
    for (const drug of removed) nextCurrent = nextCurrent.filter(m => m !== drug);
    for (const drug of addedChips) if (!nextCurrent.includes(drug)) nextCurrent = [...nextCurrent, drug];

    updateMeds(added ? [...nextCurrent, added] : nextCurrent);

    if (removed.length > 0) {
      setCards(prev =>
        prev.filter(c => {
          if (removed.includes(entryDrug(c))) return false;
          if (c.kind !== 'assessment') return true;
          return !removed.includes(c.assessment.triggeredBy) && !(c.assessment.inhibitor && removed.includes(c.assessment.inhibitor.drug));
        })
      );
    }
    recheck(nextCurrent);
  };

  // ---- What the screen shows: the most severe alert (RED > YELLOW > GREY > GREEN) ----
  const sorted = useMemo(() => sortBySeverity(cards), [cards]);
  const assessments = useMemo(
    () => sorted.map(c => (c.kind === 'assessment' ? c.assessment : null)).filter((a): a is DrugAssessment => a !== null),
    [sorted]
  );
  const result = useMemo(
    () => (assessments.length > 0 ? toRxGeneResult(assessments, patient, added ?? prescription, meds) : undefined),
    [assessments, patient, added, prescription, meds]
  );
  const explainAssessment = useMemo(() => {
    if (assessments.length === 0) return null;
    // Same ordering rule as toRxGeneResult's primary pick, but keep a null on a CDS mismatch
    // (ConnectedApp disables explanation on mismatch; here every entry we map is local/cds-agreed).
    const top = sorted[0];
    return top && top.kind === 'assessment' && !top.mismatch ? top.assessment : null;
  }, [assessments, sorted]);

  const openEvidence = () => {
    setEvidenceKey(sorted[0]?.key ?? null);
    setEvidenceOpen(true);
  };

  /** POST /api/consult, discarding the response if the patient or meds changed mid-flight. */
  const runConsult = async () => {
    setConsultOpen(true);
    setConsultLoading(true);
    setConsultResult(null);
    setConsultError(null);
    const requestId = ++consultEpochRef.current;

    const outcome = await fetchConsult(
      {
        id: patient.id,
        name: patient.name,
        cyp2d6: patient.cyp2d6,
        cyp2c19: patient.cyp2c19,
        meds: currentMeds,
      },
      added ?? undefined,
      () => consultEpochRef.current !== requestId
    );

    if (outcome.kind === 'stale') return; // a patient/med change mid-flight wins; don't touch state

    if (outcome.kind === 'ok') {
      setConsultResult(outcome.data);
    } else if (outcome.kind === 'http-error') {
      setConsultError(`The consult request failed (HTTP ${outcome.status}).`);
    } else {
      setConsultError(outcome.message || 'Network error while requesting the consult note.');
    }
    setConsultLoading(false);
  };

  /** "Reset": re-select the current patient, which resets meds to the preset list, clears
   *  the added drug (and so the URL ?add=), and closes every sheet — same as ConnectedApp. */
  const reset = () => selectPatient(patient.id);

  const onPrescriptionChange = (value: string) => setPrescription(value);

  const consultView = toConsultViewModel(consultResult);

  return (
    <>
      <RxGeneUI
        patientOptions={PATIENT_OPTIONS}
        patientValue={patient.id}
        medicationOptions={MEDICATION_OPTIONS}
        medicationValues={currentMeds}
        prescriptionOptions={PRESCRIPTION_OPTIONS}
        prescriptionValue={prescription}
        result={result}
        pending={pending > 0}
        playing={playing}
        reduceMotion={reduceMotion}
        onPatientChange={selectPatient}
        onMedicationsChange={onMedicationsChange}
        onPrescriptionChange={onPrescriptionChange}
        onCheck={checkPrescription}
        onReset={reset}
        onEvidence={openEvidence}
        onExplanation={() => setExplainOpen(true)}
        onReviewMedications={() => void runConsult()}
        onTogglePlay={() => setPlaying(p => !p)}
      />

      <EvidenceSheet
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        entries={sorted}
        selectedKey={evidenceKey}
        onSelect={setEvidenceKey}
        meds={meds}
        mode={mode}
        exchange={exchange}
      />

      <PatientExplanationSheet
        open={explainOpen}
        onOpenChange={setExplainOpen}
        assessment={explainAssessment}
        initialLang={lang}
      />

      <ConsultSheet
        open={consultOpen}
        onOpenChange={setConsultOpen}
        note={consultView?.note ?? null}
        source={consultResult?.source ?? null}
        model={consultResult?.model}
        trace={consultView?.trace ?? []}
        loading={consultLoading}
        error={consultError}
        onRetry={() => void runConsult()}
        reviewingCount={added ? meds.length : meds.length - (added ? 1 : 0)}
      />
    </>
  );
}
