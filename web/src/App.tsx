import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, LoaderCircle, RotateCcw } from 'lucide-react';
import { ComparisonStrip } from '@/components/ComparisonStrip';
import { EvidenceSheet } from '@/components/EvidenceSheet';
import { Gauge } from '@/components/Gauge';
import { MedList } from '@/components/MedList';
import { ModeToggle } from '@/components/ModeToggle';
import { PatientExplanationSheet } from '@/components/PatientExplanationSheet';
import { PatientPicker } from '@/components/PatientPicker';
import { PrescriptionPicker } from '@/components/PrescriptionPicker';
import { StoryRow } from '@/components/StoryRow';
import { VerdictBar } from '@/components/VerdictBar';
import { Button } from '@/components/ui/button';
import { patients, findPatient, type PresetPatient } from '@/data/patients';
import { checkOrder } from '@/engine';
import { entryDrug, cdsEntries, localEntries, type CardEntry } from '@/lib/cardEntries';
import { buildRequest, send, type CdsExchange, type OrderSelectRequest } from '@/lib/cdsClient';
import { enterExit, STEP } from '@/lib/motion';
import { readUrlState, resolveUrlState, toUrlState, writeUrlState, type Mode } from '@/lib/url';
import { entryAlert, genotypePhenotypeFor, geneFor, sortBySeverity, speedOf, toVerdict } from '@/lib/verdict';

type Exchange = { request: OrderSelectRequest; result: CdsExchange | null };

function Divider() {
  return <span aria-hidden="true" className="hidden h-7 w-px bg-ink/20 sm:block" />;
}

function App() {
  // URL -> initial state, once. ?add= both adds the drug and runs the check (below).
  const [initial] = useState(() => resolveUrlState(readUrlState()));
  const [patientId, setPatientId] = useState(initial.patient.id);
  const [meds, setMeds] = useState<string[]>(() => (initial.add ? [...initial.meds, initial.add] : initial.meds));
  const [added, setAdded] = useState<string | null>(initial.add);
  // The drug in the "Check prescription" select. It's checked only when the button is pressed.
  const [prescription, setPrescription] = useState<string>(initial.add ?? initial.patient.demoDrug);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [lang] = useState(initial.lang);
  const [cards, setCards] = useState<CardEntry[]>([]);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [pending, setPending] = useState(0);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [evidenceKey, setEvidenceKey] = useState<string | null>(null);

  // Results that arrive after a patient/mode change, or after their drug was removed, are dropped.
  const epochRef = useRef(0);
  const medsRef = useRef(meds);
  const bootedRef = useRef(false);
  const reduce = !!useReducedMotion();

  const patient = findPatient(patientId) ?? patients[0];
  const currentMeds = added ? meds.filter(m => m !== added) : meds;

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
    setEvidenceKey(null);
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
  };

  const changeMode = (next: Mode) => {
    if (next === mode) return;
    resetResults();
    setMode(next);
    // Re-run the current check so the cards show where they came from in the new mode.
    if (added) void runCheck(patient, meds.filter(m => m !== added), added, next);
  };

  /** "Check prescription": the selected drug replaces any earlier prescription and is checked. */
  const checkPrescription = () => {
    const drug = prescription.toLowerCase();
    const current = meds.filter(m => m !== added && m.toLowerCase() !== drug);
    resetResults();
    updateMeds([...current, drug]);
    setAdded(drug);
    void runCheck(patient, current, drug, mode);
  };

  /** After a check, editing the chips re-runs it at once (DESIGN.md section 1). */
  const recheck = (current: string[]) => {
    if (!added) return;
    epochRef.current++; // only the latest re-check's answer is applied
    void runCheck(patient, current, added, mode);
  };

  const addCurrentMed = (input: string) => {
    const drug = input.toLowerCase();
    if (meds.some(m => m.toLowerCase() === drug)) return;
    const current = [...currentMeds, drug];
    updateMeds(added ? [...current, added] : current);
    recheck(current);
  };

  const removeCurrentMed = (drug: string) => {
    const current = currentMeds.filter(m => m !== drug);
    updateMeds(added ? [...current, added] : current);
    // Clear the drug's own cards, any card it triggered (e.g. the reverse case),
    // and any card whose phenoconversion depended on it as the inhibitor.
    setCards(prev =>
      prev.filter(c => {
        if (entryDrug(c) === drug) return false;
        if (c.kind !== 'assessment') return true;
        return c.assessment.triggeredBy !== drug && c.assessment.inhibitor?.drug !== drug;
      })
    );
    recheck(current);
  };

  // ---- What the screen shows: the most severe alert (RED > YELLOW > GREY > GREEN) ----
  const sorted = useMemo(() => sortBySeverity(cards), [cards]);
  const top = sorted[0] ?? null;
  const topVerdict = top ? toVerdict(top) : null;
  const topAssessment = topVerdict?.assessment ?? null;
  const level = top ? entryAlert(top) : null;
  const focusDrug = top ? entryDrug(top) : prescription;
  const gene = topAssessment?.gene ?? geneFor(focusDrug, patient);
  const genotype = topAssessment ? topAssessment.genotype : ((gene === 'CYP2D6' ? patient.cyp2d6 : patient.cyp2c19) ?? null);
  const genotypePhenotype = topAssessment?.genotypePhenotype ?? genotypePhenotypeFor(patient, gene);

  // The same drug against the genotype alone, from the engine, for the comparison strip.
  const geneOnly = useMemo(() => {
    if (!topAssessment?.phenoconverted) return null;
    return checkOrder({ ...patient, meds: [] }, topAssessment.drug).find(x => x.drug === topAssessment.drug) ?? null;
  }, [patient, topAssessment]);

  const showStrip = topAssessment?.phenoconverted === true;
  const verdictDelay = showStrip ? STEP.strip + 3 * STEP.stripStagger : STEP.strip;
  const nowNote = topAssessment?.adjustedPhenotype === 'not computed' ? 'With medications: not computed (pharmacist review)' : null;
  const explainAssessment = topVerdict && !topVerdict.mismatch ? topAssessment : null;

  const openEvidence = (key: string | null = null) => {
    setEvidenceKey(key ?? top?.key ?? null);
    setEvidenceOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-bg text-ink">
        <header className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 pt-5 pb-3">
          <div className="flex items-center gap-4">
            <p className="text-[32px]/none font-bold tracking-[-0.02em] text-ink">
              RxGene<span className="text-alert-red">.</span>
            </p>
            <Divider />
            <p className="text-lg text-ink">Pharmacogenomics</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm font-semibold tracking-[0.2em] text-ink-muted">SYNTHETIC DEMO</p>
            <Divider />
            <ModeToggle mode={mode} onChange={changeMode} />
            <Divider />
            <Button
              variant="ghost"
              className="press h-10 px-3 text-base font-medium text-ink"
              onClick={() => openEvidence()}
              disabled={cards.length === 0}
            >
              Evidence
            </Button>
            <Button
              variant="ghost"
              className="press h-10 px-3 text-base font-medium text-ink"
              onClick={() => selectPatient(patient.id)}
            >
              <RotateCcw aria-hidden="true" className="size-5" strokeWidth={1.5} />
              Reset
            </Button>
          </div>
        </header>

        <main className="mx-auto flex max-w-[1400px] flex-col gap-5 px-6 pb-8">
          {/* Control bar: panel rounded-2xl, inputs rounded-lg, padding above 24px */}
          <section
            aria-label="Prescription check"
            className="panel grid grid-cols-1 items-end gap-x-6 gap-y-4 rounded-2xl p-7 md:grid-cols-2 lg:grid-cols-[minmax(13rem,1fr)_minmax(16rem,1.5fr)_minmax(13rem,1.2fr)_auto]"
          >
            <PatientPicker patients={patients} selectedId={patientId} onSelect={selectPatient} />
            <MedList meds={currentMeds} checking={added} onAdd={addCurrentMed} onRemove={removeCurrentMed} />
            <PrescriptionPicker value={prescription} onChange={setPrescription} />
            <Button
              className="press h-12 rounded-lg pr-[18px]! pl-5! text-lg font-semibold"
              onClick={checkPrescription}
            >
              Check prescription
              <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2} />
            </Button>
          </section>

          <div className="flex flex-col gap-1 pt-2">
            <h1 className="text-[40px]/[44px] font-bold tracking-[-0.02em] text-ink lg:text-[56px]/[60px]">
              Same genes. Different response.
            </h1>
            <p className="text-lg text-ink">See how current medications change this prescription assessment.</p>
          </div>

          <Status pending={pending > 0} fallbackError={fallbackError} headline={topVerdict?.headline ?? null} />

          <StoryRow
            patientName={patient.name}
            drug={focusDrug}
            gene={gene}
            genotype={genotype}
            genotypePhenotype={genotypePhenotype}
            assessment={topAssessment}
            level={level}
            pending={pending > 0}
          />

          <Gauge
            byGenes={speedOf(genotypePhenotype)}
            now={topAssessment ? speedOf(topAssessment.adjustedPhenotype) : null}
            level={level}
            reducedConfidence={topAssessment?.confidence === 'reduced'}
            nowNote={nowNote}
          />

          {/* Re-checks swap these regions: exits 150 ms, enters 300 ms. */}
          <div className="relative">
            <AnimatePresence mode="popLayout" initial={false}>
              {showStrip && topAssessment && (
                <motion.div key={`strip-${top?.key}`} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                  <ComparisonStrip assessment={topAssessment} geneOnly={geneOnly} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="sticky bottom-4 z-20">
            <AnimatePresence mode="popLayout" initial={false}>
              {topVerdict ? (
                <motion.div
                  key={`${topVerdict.key}-${topVerdict.level}-${topVerdict.headline}`}
                  {...enterExit(reduce, verdictDelay)}
                >
                  <VerdictBar
                    verdict={topVerdict}
                    moreCount={sorted.length - 1}
                    onInspect={() => openEvidence()}
                    onMore={() => openEvidence()}
                    onExplain={() => setExplainOpen(true)}
                    explainDisabled={!explainAssessment}
                  />
                </motion.div>
              ) : (
                <motion.div key={pending > 0 ? 'pending' : 'idle'} {...enterExit(reduce)}>
                  <IdleVerdict pending={pending > 0} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

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
      </div>
    </MotionConfig>
  );
}

/** Before a check (or while the CDS Hooks call is in flight). */
function IdleVerdict({ pending }: { pending: boolean }) {
  return (
    <div className="panel flex items-center gap-3 rounded-2xl px-6 py-5 text-base text-ink">
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" strokeWidth={2} />
          Checking via CDS Hooks…
        </>
      ) : (
        'Choose a prescription and press Check prescription.'
      )}
    </div>
  );
}

/** Screen-reader announcement of the result, plus the visible CDS Hooks fallback notice. */
function Status({ pending, fallbackError, headline }: { pending: boolean; fallbackError: string | null; headline: string | null }) {
  return (
    <>
      <p className="sr-only" aria-live="polite" aria-busy={pending}>
        {pending ? 'Checking via CDS Hooks…' : headline ? `Result: ${headline}` : ''}
      </p>
      {fallbackError && (
        <p role="status" className="panel rounded-2xl px-5 py-3 text-base text-ink">
          CDS Hooks call failed ({fallbackError}). Showing results from the local engine.
        </p>
      )}
    </>
  );
}

export default App;
