// Public, backend-agnostic UI contract for the RxGene presentation view. The component that
// consumes these types (RxGeneUI) makes ZERO clinical decisions and ZERO network/engine calls:
// it renders exactly what it is given and reports user intent through callbacks. A backend can
// map its own result into RxGeneResult and wire the callbacks to its data layer.

/** Qualitative "clears this drug" speed used by the ruler and the current-response word. */
export type FlowSpeed = 'Slow' | 'Reduced' | 'Normal' | 'Fast';

/** Alert severity. GREEN is a genotype-only "no supported alert", never a clinical "safe". */
export type AlertLevel = 'RED' | 'YELLOW' | 'GREEN' | 'GREY';

/**
 * How the conceptual pathway animates. Purely illustrative — the backend decides which state
 * applies; the UI never derives it. Green throughput is illustrative processing, not approval.
 */
export type FlowState = 'idle' | 'notAssessed' | 'guidance' | 'normal' | 'reduced' | 'inhibited';

export type SelectOption = {
  /** Stable value passed back through callbacks. */
  value: string;
  /** Human label shown in the control. */
  label: string;
  /** Optional secondary line (e.g. the gene summary in the patient menu). */
  detail?: string;
};

/** A link shown in the verdict/evidence (FDA label, CPIC guideline, etc.). */
export type SourceLink = { label: string; url?: string };

/** The inhibitor chip shown above the enzyme, or null when there is none. */
export type InhibitorView = {
  drug: string;
  /** Free text, e.g. "Strong inhibitor" — the UI does not classify strength itself. */
  strengthLabel: string;
};

/** The bottom verdict band content. All text comes from the backend verbatim. */
export type VerdictView = {
  level: AlertLevel;
  /** Small kicker above the headline, e.g. "Prescription review". */
  kicker: string;
  /** Large headline, e.g. "Avoid codeine." */
  headline: string;
  /** Optional qualifier under the headline (e.g. GREEN "(not the same as safe)"). */
  qualifier?: string;
  /** Plain rationale shown in the middle, 1–2 lines. */
  rationale: string;
  /** Source line, e.g. "CPIC Opioids · 2021 · Strong recommendation". */
  source?: string;
  /** Whether the "Patient explanation" action is available. */
  explanationAvailable?: boolean;
};

/**
 * The full result view-model the backend supplies after a check. Optional: when undefined the
 * UI shows the neutral pre-check scene.
 */
export type RxGeneResult = {
  gene: string;
  diplotype: string;
  /** Baseline phenotype wording, e.g. "Normal by genes". */
  baselineLabel: string;
  /** ○ by-genes marker position on the ruler. */
  baselineSpeed: FlowSpeed | null;
  /** The drug being checked, capitalized, e.g. "Codeine". */
  drugLabel: string;
  /** Big current-response word, e.g. "Slow". When null, see currentLabel. */
  currentSpeed: FlowSpeed | null;
  /** Fallback big word when currentSpeed is null, e.g. "Not assessed" / "Dosing guidance". */
  currentLabel: string;
  /** Activity-score pair for the right column (strings, already formatted), or null. */
  scoreBefore?: string | null;
  scoreAfter?: string | null;
  /** Small note under the score, e.g. "Rule-adjusted". */
  scoreNote?: string | null;
  /** Plain output label near the enzyme, e.g. "Reduced morphine formation". */
  outputLabel: string;
  /** Conceptual pathway animation state. */
  flowState: FlowState;
  /** Inhibitor chip above the enzyme, or null. */
  inhibitor: InhibitorView | null;
  /** One explanatory sentence centered under the scene. */
  caption: string;
  /** The bottom verdict band. */
  verdict: VerdictView;
  /** Evidence sheet content (demo/backed text). */
  evidenceTitle?: string;
  evidenceBody?: string;
  sourceLinks?: SourceLink[];
  /** Patient explanation sheet content. */
  explanationTitle?: string;
  explanationBody?: string;
};

/**
 * Props for the controlled, backend-agnostic RxGeneUI. The parent owns all state; this
 * component is pure presentation + intent callbacks.
 */
export type RxGeneUIProps = {
  patientOptions: SelectOption[];
  patientValue: string;

  medicationOptions: SelectOption[];
  /** Current medications already on the patient's list (chips). */
  medicationValues: string[];

  prescriptionOptions: SelectOption[];
  prescriptionValue: string;

  /** The result to render, or undefined for the neutral pre-check scene. */
  result?: RxGeneResult;

  /** True while a (host-owned) check is resolving; shows a subtle busy state and disables Check. */
  pending?: boolean;

  /** Pathway playback state (host-owned so it resets with the result). */
  playing: boolean;
  /** True under prefers-reduced-motion; the UI shows static glossy spheres. */
  reduceMotion: boolean;

  onPatientChange: (value: string) => void;
  onMedicationsChange: (values: string[]) => void;
  onPrescriptionChange: (value: string) => void;
  onCheck: () => void;
  onReset: () => void;
  onEvidence: () => void;
  onExplanation: () => void;
  /** Toggle pathway playback. */
  onTogglePlay: () => void;
};
