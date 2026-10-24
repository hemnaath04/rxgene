import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCard, CdsOnlyCard, NotCoveredCard } from '@/components/AlertCard';
import { CdsExchangePanel } from '@/components/CdsExchangePanel';
import { MedList } from '@/components/MedList';
import { ModeToggle } from '@/components/ModeToggle';
import { PatientPicker } from '@/components/PatientPicker';
import { patients, findPatient, type PresetPatient } from '@/data/patients';
import { checkOrder } from '@/engine';
import { getActivityScore } from '@/engine/activityScore';
import { activityScoreToPhenotype, cyp2c19DiplotypeToPhenotype } from '@/engine/phenotype';
import { cdsEntries, entryDrug, localEntries, type CardEntry } from '@/lib/cardEntries';
import { buildRequest, send, type CdsExchange, type OrderSelectRequest } from '@/lib/cdsClient';
import { readUrlState, resolveUrlState, toUrlState, writeUrlState, type Mode } from '@/lib/url';

type Exchange = { request: OrderSelectRequest; result: CdsExchange | null };

/** Gene result in plain words, from the genotype alone (no medicines considered). */
function cyp2d6ByGenes(genotype?: string): string {
  const result = getActivityScore(genotype);
  if (result.activityScore === null) return result.phenotype;
  return activityScoreToPhenotype(result.activityScore);
}

function GeneChart({ patient }: { patient: PresetPatient }) {
  return (
    <section aria-labelledby="chart-heading">
      <h2 id="chart-heading">{patient.name}'s gene results</h2>
      <ul>
        <li>
          CYP2D6: {patient.cyp2d6 ? `${patient.cyp2d6} — ${cyp2d6ByGenes(patient.cyp2d6)}` : 'No result on file'}
        </li>
        <li>
          CYP2C19:{' '}
          {patient.cyp2c19
            ? `${patient.cyp2c19} — ${cyp2c19DiplotypeToPhenotype(patient.cyp2c19)}`
            : 'No result on file'}
        </li>
      </ul>
      <p>Suggested demo: add {patient.demoDrug}.</p>
    </section>
  );
}

function App() {
  // URL -> initial state, once. ?add= both adds the drug and runs the check (below).
  const [initial] = useState(() => resolveUrlState(readUrlState()));
  const [patientId, setPatientId] = useState(initial.patient.id);
  const [meds, setMeds] = useState<string[]>(() => (initial.add ? [...initial.meds, initial.add] : initial.meds));
  const [added, setAdded] = useState<string | null>(initial.add);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [lang] = useState(initial.lang);
  const [cards, setCards] = useState<CardEntry[]>([]);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [pending, setPending] = useState(0);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  // Results that arrive after a patient/mode change, or after their drug was removed, are dropped.
  const epochRef = useRef(0);
  const medsRef = useRef(meds);
  const bootedRef = useRef(false);

  const patient = findPatient(patientId) ?? patients[0];

  useEffect(() => {
    writeUrlState(toUrlState({ patient, meds, add: added, mode, lang }));
  }, [patient, meds, added, mode, lang]);

  const mergeCards = useCallback((fresh: CardEntry[]) => {
    // A fresh assessment of a drug replaces its older card.
    const freshDrugs = new Set(fresh.map(entryDrug));
    setCards(prev => [...fresh, ...prev.filter(c => !freshDrugs.has(entryDrug(c)))]);
  }, []);

  /** Check `drug` against `currentMeds` (the list before it was added). The engine decides. */
  const runCheck = useCallback(
    async (p: PresetPatient, currentMeds: string[], drug: string, checkMode: Mode) => {
      const local = () => checkOrder({ ...p, meds: currentMeds }, drug);

      if (checkMode === 'local') {
        mergeCards(localEntries(drug, local(), 'local'));
        setExchange(null);
        setFallbackError(null);
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
      // Local assessments fill the phenotype panel; the server card sets the level.
      const assessments = local();
      if (result.ok) {
        mergeCards(cdsEntries(drug, result.response.cards, assessments));
        setFallbackError(null);
      } else {
        mergeCards(localEntries(drug, assessments, 'local-fallback'));
        setFallbackError(result.error);
      }
    },
    [mergeCards]
  );

  // Deep link (/?patient=sarah&add=codeine): run the check on first load, in either mode.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (initial.add) void runCheck(initial.patient, initial.meds, initial.add, initial.mode);
  }, [initial, runCheck]);

  const resetResults = () => {
    epochRef.current++;
    setCards([]);
    setExchange(null);
    setFallbackError(null);
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
  };

  const changeMode = (next: Mode) => {
    if (next === mode) return;
    resetResults();
    setMode(next);
    // Re-run the current check so the cards show where they came from in the new mode.
    if (added) void runCheck(patient, meds.filter(m => m !== added), added, next);
  };

  const addDrug = (input: string) => {
    const drug = input.toLowerCase();
    if (meds.some(m => m.toLowerCase() === drug)) return;
    const current = meds;
    updateMeds([...current, drug]);
    setAdded(drug);
    void runCheck(patient, current, drug, mode);
  };

  const removeDrug = (drug: string) => {
    updateMeds(meds.filter(m => m !== drug));
    if (drug === added) setAdded(null);
    // Clear the drug's own cards, any card it triggered (e.g. the reverse case),
    // and any card whose phenoconversion depended on it as the inhibitor.
    setCards(prev =>
      prev.filter(c => {
        if (entryDrug(c) === drug) return false;
        if (c.kind !== 'assessment') return true;
        return c.assessment.triggeredBy !== drug && c.assessment.inhibitor?.drug !== drug;
      })
    );
  };

  return (
    <main>
      <header>
        <h1>RxGene</h1>
        <p>Pre-prescription pharmacogenomics check. Synthetic data only. Not a medical device.</p>
        <PatientPicker patients={patients} selectedId={patientId} onSelect={selectPatient} />
        <ModeToggle mode={mode} onChange={changeMode} />
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <GeneChart patient={patient} />
          <MedList meds={meds} onAdd={addDrug} onRemove={removeDrug} />
        </div>

        <section aria-labelledby="alerts-heading" aria-live="polite" aria-busy={pending > 0}>
          <h2 id="alerts-heading">Alerts</h2>
          {pending > 0 && <p>Checking via CDS Hooks…</p>}
          {fallbackError && (
            <p>CDS Hooks call failed ({fallbackError}). Showing results from the local engine.</p>
          )}
          {cards.length === 0 ? (
            pending === 0 && <p>Add a medication to run the check.</p>
          ) : (
            cards.map(c => {
              if (c.kind === 'assessment') {
                return (
                  <AlertCard
                    key={c.key}
                    assessment={c.assessment}
                    via={c.via}
                    alert={c.alert}
                    cdsSummary={c.cdsSummary}
                    mismatch={c.mismatch}
                  />
                );
              }
              if (c.kind === 'cds-only') {
                return <CdsOnlyCard key={c.key} card={c.card} alert={c.alert} mismatch={c.mismatch} />;
              }
              return <NotCoveredCard key={c.key} drug={c.key} via={c.via} />;
            })
          )}

          {mode === 'ehr' && exchange && <CdsExchangePanel request={exchange.request} result={exchange.result} />}
        </section>
      </div>
    </main>
  );
}

export default App;
