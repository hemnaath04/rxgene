import { useState } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConsultSheet, type ConsultNote, type TraceEntry } from '@/components/ConsultSheet';
import { OpenFDAPanel } from '@/components/EvidenceSheet';
import { RxGeneUI } from '@/ui/RxGeneUI';
import type { RxGeneResult } from '@/ui/types';
import {
  MEDICATION_OPTIONS,
  PATIENT_OPTIONS,
  PRESCRIPTION_OPTIONS,
  PRIYA_NORMAL,
  SARAH_INHIBITED,
  notAssessedPreview,
} from '@/ui/demoFixtures';

/**
 * Demo state adapter for the standalone UI-only view. It owns controlled state and maps a drafted
 * selection to a known fixture when the user presses Check — purely for the synthetic demo. It
 * imports fixture objects ONLY; there is NO engine import and NO network call here. A production
 * integration would replace this adapter with one that calls the backend and supplies its own
 * RxGeneResult to <RxGeneUI/>, and a live agent note to <ConsultSheet/>.
 */

type Draft = {
  patient: string;
  medications: string[];
  prescription: string;
};

const SARAH_DEFAULT: Draft = { patient: 'sarah', medications: ['fluoxetine'], prescription: 'codeine' };

/** Resolve a drafted selection to a fixture result. Known synthetic cases only. */
function resolveFixture(draft: Draft): RxGeneResult {
  const presLabel = PRESCRIPTION_OPTIONS.find(o => o.value === draft.prescription)?.label ?? 'This drug';

  // Sarah + Fluoxetine + Codeine → the exact screenshot (inhibited).
  if (draft.patient === 'sarah' && draft.prescription === 'codeine' && draft.medications.includes('fluoxetine')) {
    return SARAH_INHIBITED;
  }
  // Codeine with no inhibitor on the list → normal illustrative throughput.
  if (draft.prescription === 'codeine' && draft.medications.length === 0) {
    return draft.patient === 'priya' ? PRIYA_NORMAL : { ...PRIYA_NORMAL, caption: 'No CYP2D6 inhibitor on the medication list. Genes are unchanged.' };
  }
  // Anything else: neutral preview, never invented dosing.
  return notAssessedPreview(presLabel);
}

/**
 * Build a deterministic consult-note PREVIEW from the committed result. This is NOT a live agent:
 * every sentence reuses text that already exists on the RxGeneResult (evidence body, verdict
 * rationale, explanation body). No new clinical text, dose or drug is invented. The two trace
 * entries (T1/T2) are explicit demo-preview fixtures with the ids the citations point to.
 */
function buildDemoConsult(result: RxGeneResult): { note: ConsultNote; trace: TraceEntry[] } {
  const trace: TraceEntry[] = [
    {
      id: 'T1',
      tool: 'Gene result preview',
      args: { patientGene: result.gene, diplotype: result.diplotype },
      summary: `Demo preview — ${result.gene} ${result.diplotype}: ${result.baselineLabel}.`,
      ms: 0,
    },
    {
      id: 'T2',
      tool: 'Prescription assessment preview',
      args: { drug: result.drugLabel, level: result.verdict.level },
      summary: `Demo preview — ${result.drugLabel}: ${result.verdict.rationale}`,
      ms: 0,
    },
  ];

  const sections: ConsultNote['sections'] = [];

  // Assessment section — reuse the verdict rationale and any evidence body verbatim.
  const assessmentSentences = [{ text: result.verdict.rationale, cites: ['T2'] }];
  if (result.evidenceBody) {
    assessmentSentences.push({ text: result.evidenceBody, cites: ['T1', 'T2'] });
  }
  sections.push({
    heading: `${result.drugLabel}: ${result.verdict.headline}`,
    sentences: assessmentSentences,
  });

  // Patient-facing section — reuse the existing plain-language explanation body if present.
  if (result.explanationBody) {
    sections.push({
      heading: result.explanationTitle ?? 'For the patient',
      sentences: [{ text: result.explanationBody, cites: ['T1'] }],
    });
  }

  return { note: { sections }, trace };
}

export default function RxGeneDemo() {
  // The committed view (what the scene/verdict show) starts on the exact Sarah screenshot.
  const [result, setResult] = useState<RxGeneResult | undefined>(SARAH_INHIBITED);
  // The drafted controls (may differ from the committed result until Check is pressed).
  const [draft, setDraft] = useState<Draft>(SARAH_DEFAULT);
  const [playing, setPlaying] = useState(true); // autoplay explanatory motion in the synthetic demo
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const reduceMotion = !!useReducedMotion();

  const check = () => {
    setResult(resolveFixture(draft));
    setPlaying(true);
  };

  // Editing any draft control clears the committed result, stops playback, and closes the consult
  // so an old patient's result or stale note is never shown against new inputs until Check runs.
  const editDraft = (patch: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...patch }));
    setResult(undefined);
    setPlaying(false);
    setConsultOpen(false);
  };

  const reset = () => {
    setDraft(SARAH_DEFAULT);
    setResult(SARAH_INHIBITED);
    setPlaying(true);
    setEvidenceOpen(false);
    setExplainOpen(false);
    setConsultOpen(false);
  };

  // "Review full medication list": open a deterministic, locally-built consult preview from the
  // committed result. No network, no live agent. Undefined result disables this action in the UI.
  const consult = result ? buildDemoConsult(result) : null;

  return (
    <MotionConfig reducedMotion="user">
      <RxGeneUI
        patientOptions={PATIENT_OPTIONS}
        patientValue={draft.patient}
        medicationOptions={MEDICATION_OPTIONS}
        medicationValues={draft.medications}
        prescriptionOptions={PRESCRIPTION_OPTIONS}
        prescriptionValue={draft.prescription}
        result={result}
        playing={playing}
        reduceMotion={reduceMotion}
        onPatientChange={patient => editDraft({ patient })}
        onMedicationsChange={medications => editDraft({ medications })}
        onPrescriptionChange={prescription => editDraft({ prescription })}
        onCheck={check}
        onReset={reset}
        onEvidence={() => setEvidenceOpen(true)}
        onExplanation={() => setExplainOpen(true)}
        onReviewMedications={() => result && setConsultOpen(true)}
        onTogglePlay={() => setPlaying(p => !p)}
      />

      {/* Pharmacist consult draft (deterministic demo preview, template source). */}
      <ConsultSheet
        open={consultOpen}
        onOpenChange={setConsultOpen}
        note={consult?.note ?? null}
        source="template"
        trace={consult?.trace ?? []}
        loading={false}
        preview
        reason="Demo preview: built locally from the current result. Connect the backend for a live agent note."
        reviewingCount={draft.medications.length}
      />

      {/* Evidence sheet (demo text) */}
      <Sheet open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <SheetContent
          side="right"
          className="overflow-y-auto overscroll-contain bg-panel-solid data-[side=right]:w-[min(640px,100vw)]! data-[side=right]:max-w-none!"
        >
          <SheetHeader className="px-6 pt-6">
            <SheetTitle className="text-xl font-semibold text-ink">{result?.evidenceTitle ?? 'Evidence'}</SheetTitle>
            <SheetDescription className="text-base text-ink-muted">
              The technical detail behind the alert. Synthetic data only.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-6 pb-8">
            {result?.evidenceBody && <p className="text-base whitespace-pre-wrap text-ink">{result.evidenceBody}</p>}
            {result?.sourceLinks && result.sourceLinks.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm text-ink">
                {result.sourceLinks.map(link => (
                  <li key={link.label}>
                    {link.label}
                    {link.url && (
                      <>
                        {': '}
                        <a className="break-all text-marine underline underline-offset-2" href={link.url} target="_blank" rel="noreferrer">
                          {link.url}
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* Real-world FAERS reports, subordinate to the guideline/source content above.
                Uses the local openFDA snapshot; no fetch. Renders nothing when no pair matches. */}
            {result && <OpenFDAPanel drug={result.drugLabel.toLowerCase()} meds={draft.medications} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Patient explanation sheet (demo text) */}
      <Sheet open={explainOpen} onOpenChange={setExplainOpen}>
        <SheetContent
          side="right"
          className="overflow-y-auto overscroll-contain bg-panel-solid data-[side=right]:w-[min(480px,100vw)]! data-[side=right]:max-w-none!"
        >
          <SheetHeader className="px-6 pt-6">
            <SheetTitle className="text-xl font-semibold text-ink">{result?.explanationTitle ?? 'Patient explanation'}</SheetTitle>
            <SheetDescription className="text-base text-ink-muted">
              Plain-language summary. It never decides anything.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-8">
            {result?.explanationBody ? (
              <p className="text-base text-ink">{result.explanationBody}</p>
            ) : (
              <p className="text-base text-ink">No patient explanation for this result.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </MotionConfig>
  );
}
