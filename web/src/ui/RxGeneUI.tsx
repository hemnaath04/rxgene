import type { CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Info, Lock, Pause, Pill, Play, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FlowState, RxGeneResult, RxGeneUIProps, SelectOption } from '@/ui/types';
import './rxgene-ui.css';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function labelFor(options: SelectOption[], value: string): string {
  return options.find(o => o.value === value)?.label ?? value;
}

/** Proportional length in scene units (--u). */
const u = (n: number) => `calc(${n} * var(--u))`;

/** A glossy sphere (radial gradient). Pure CSS — stays glossy even when static. */
function Sphere({
  kind,
  size,
  travel,
  delay,
  left,
  dy = 0,
  pulse,
  dim,
}: {
  kind: 'green' | 'coral' | 'blue';
  size: number;
  travel?: number;
  delay?: number;
  left: number;
  dy?: number;
  pulse?: boolean;
  dim?: boolean;
}) {
  const animClass = travel != null ? 'rx-anim-travel' : pulse ? 'rx-anim-pulse' : '';
  return (
    <span
      aria-hidden="true"
      className={`rx-sphere rx-sphere-${kind} ${animClass}`}
      style={
        {
          position: 'absolute',
          width: u(size),
          height: u(size),
          left: u(left),
          top: '50%',
          transform: `translate(0, calc(-50% + ${u(dy)}))`,
          opacity: dim ? 0.7 : undefined,
          ['--rx-travel-x']: travel != null ? u(travel) : undefined,
          ['--rx-delay']: delay != null ? `${delay}s` : undefined,
        } as CSSProperties
      }
    />
  );
}

const SPEED_X: Record<string, string> = { Slow: '0%', Reduced: '33.333%', Normal: '66.667%', Fast: '100%' };

/* ------------------------------------------------------------------ *
 * Scene — absolutely positioned desktop coordinate system; reflows on mobile.
 * ------------------------------------------------------------------ */

function StageHead({ cls, n, title }: { cls: string; n: string; title: string }) {
  return (
    <div className={`rx-stage-head ${cls}`}>
      <span className="rx-num">{n}</span>
      <h2>{title}</h2>
      <span aria-hidden="true" className="rx-rule" />
    </div>
  );
}

function PlayControl({ playing, disabled, onToggle }: { playing: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={playing ? 'Pause pathway animation' : 'Play pathway animation'}
      className="rx-press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--rx-control-border)] bg-white/70 px-2.5 py-1 text-sm font-semibold text-[var(--rx-ink)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {playing ? <Pause aria-hidden="true" className="size-4" strokeWidth={2} /> : <Play aria-hidden="true" className="size-4" strokeWidth={2} />}
      {playing ? 'Pause' : 'Play pathway'}
    </button>
  );
}

function ParticleLayer({ flow, animate, stall }: { flow: FlowState; animate: boolean; stall?: boolean }) {
  const isInhibited = flow === 'inhibited';
  const isNormal = flow === 'normal';
  const isReduced = flow === 'reduced';
  if (!(isNormal || isReduced || isInhibited)) return null;

  // Path is 680u wide. Gate center at 312u (x=832 global). Inhibited green spheres start at
  // left 0 and travel ≤280u so their right edge (≈306u with a 26u sphere) stops before the gate
  // at 312u. Normal/reduced travel fully across (680). Coral pile sits just before the gate;
  // blue output dots are static (diminished output, even when inhibited).
  // stall: slow by genes (poor metabolizer) with no inhibitor effect. The enzyme itself barely
  // works, so particles enter it and stop there instead of passing through.
  const greenCount = isNormal ? 8 : stall ? 4 : isReduced ? 5 : 6;
  const greenSize = isReduced ? 20 : 26;
  const greenTravel = isInhibited ? 280 : stall ? 400 : 680;

  return (
    <div className="rx-path rx-flow-clip" aria-hidden="true">
      <span className="rx-path-line" data-dashed={isReduced || undefined} />
      {animate
        ? // Moving spheres only.
          Array.from({ length: greenCount }).map((_, i) => (
            <Sphere
              key={`g-${i}`}
              kind="green"
              size={greenSize}
              left={0}
              travel={greenTravel}
              delay={-(i * (2.6 / greenCount))}
              dy={(i % 2 ? -1 : 1) * 2}
            />
          ))
        : // Static rest positions spread across the allowed span.
          Array.from({ length: greenCount }).map((_, i) => (
            <Sphere key={`gs-${i}`} kind="green" size={greenSize} left={10 + i * ((greenTravel - 20) / greenCount)} dy={(i % 2 ? -1 : 1) * 2} />
          ))}
      {/* coral pile just before the blocked gate: x770..823 → 250..303u within the path */}
      {isInhibited &&
        Array.from({ length: 5 }).map((_, i) => (
          <Sphere key={`c-${i}`} kind="coral" size={22} left={252 + (i % 3) * 16} dy={(i % 2 ? -1 : 1) * (6 + i * 2)} pulse={animate} />
        ))}
      {/* coral gate cap */}
      {isInhibited && <span className="rx-gate" />}
      {/* dim blue static output dots: x1055..1190 → 535..670u. Diminished even when inhibited. */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Sphere key={`b-${i}`} kind="blue" size={14} left={535 + i * 45} dim />
      ))}
    </div>
  );
}

function Scene({
  result,
  playing,
  onTogglePlay,
  reduceMotion,
}: {
  result?: RxGeneResult;
  playing: boolean;
  onTogglePlay: () => void;
  reduceMotion: boolean;
}) {
  const flow: FlowState = result?.flowState ?? 'idle';
  const isInhibited = flow === 'inhibited';
  const isNormal = flow === 'normal';
  const isReduced = flow === 'reduced';
  const animatable = isNormal || isReduced || isInhibited;
  const animate = playing && animatable && !reduceMotion;

  const gene = result?.gene ?? 'CYP2D6';
  const diplotype = result?.diplotype ?? '—';
  const baselineLabel = result?.baselineLabel ?? 'Gene result pending';
  const baselineMuted = result?.baselineSpeed == null;
  const inhibitor = result?.inhibitor ?? null;
  const currentWord = result?.currentSpeed ?? result?.currentLabel ?? 'Not checked yet';
  const isBigWord = !!result?.currentSpeed;

  return (
    <section className="rx-scene" aria-label="Prescription assessment scene">
      {/* Stage headings */}
      <StageHead cls="rx-head-1" n="01" title="Genetic baseline" />
      <StageHead cls="rx-head-2" n="02" title="Medication effect" />
      <StageHead cls="rx-head-3" n="03" title="Current response" />

      <div className="rx-body">
        {/* 01 Genetic baseline */}
        <div className="rx-m-stage">
          <div className="rx-m-row">
            <div className="rx-dna-frame">
              <img
                src="/art/dna-helix.webp"
                alt=""
                aria-hidden="true"
                draggable={false}
                className={`rx-dna-img ${baselineMuted ? 'opacity-40 saturate-50' : ''}`}
              />
            </div>
            <div className="rx-baseline-copy">
              <p className="rx-baseline-dip">
                {gene} · {diplotype}
              </p>
              <p className="rx-baseline-phen">{baselineLabel}</p>
              <p className="rx-baseline-lock">
                <Lock aria-hidden="true" className="shrink-0" style={{ width: u(28), height: u(28) }} strokeWidth={1.75} />
                <span>Genes unchanged</span>
              </p>
            </div>
          </div>
        </div>

        {/* 02 Medication effect */}
        <div className="rx-m-stage">
          <p className="rx-capability">Inherited enzyme capability</p>
          <span className="rx-capability-arrow" aria-hidden="true" />

          {inhibitor && (
            <div className="rx-inhibitor" data-noeffect={inhibitor.noEffect || undefined}>
              <div className="rx-inhibitor-badge">
                <Pill aria-hidden="true" className="shrink-0 text-[var(--rx-coral)]" style={{ width: u(40), height: u(40) }} strokeWidth={2} />
                <span className="flex flex-col">
                  <span className="rx-inhibitor-drug">{inhibitor.drug}</span>
                  <span className="rx-inhibitor-strength">{inhibitor.strengthLabel}</span>
                </span>
              </div>
              <span className="rx-inhibitor-stem" aria-hidden="true" />
              <span className="rx-inhibitor-tcap" aria-hidden="true" />
            </div>
          )}

          <div className="rx-capsule-wrap">
            <span className="rx-capsule" aria-hidden="true">
              <span />
              <span />
            </span>
            <p className="rx-capsule-label">{result?.drugLabel ?? 'Codeine'}</p>
          </div>

          <div className="rx-enzyme">
            <span className="rx-enzyme-glow" data-active={(isNormal || isReduced) && animate} data-blocked={isInhibited} />
            <img
              src="/art/enzyme-gateway.webp"
              alt=""
              aria-hidden="true"
              draggable={false}
              className={flow === 'idle' || flow === 'notAssessed' ? 'opacity-55 saturate-50' : ''}
            />
          </div>
          <p className="rx-enzyme-label">{gene} enzyme</p>

          <ParticleLayer flow={flow} animate={animate} stall={isReduced && result?.currentSpeed === 'Slow'} />

          <p className="rx-output">{result?.outputLabel ?? 'Check prescription to see the result'}</p>
        </div>

        {/* 03 Current response */}
        <div className="rx-current rx-m-stage">
          <p className="rx-current-label">With current medications</p>
          <p className="rx-current-word" data-small={!isBigWord || currentWord.length > 5 || undefined} style={{ color: result?.verdict.level === 'RED' ? 'var(--rx-coral)' : 'var(--rx-ink)' }}>
            {currentWord}
          </p>
          <span className="rx-current-underline" aria-hidden="true" />
          {(result?.scoreBefore || result?.scoreAfter) && (
            <p className="rx-current-score">
              Activity score{' '}
              <span
                className="font-semibold"
                style={{ color: result?.scoreBefore === result?.scoreAfter ? 'var(--rx-ink)' : result?.verdict.level === 'RED' ? 'var(--rx-coral)' : result?.verdict.level === 'YELLOW' ? '#d98a2b' : 'var(--rx-ink)' }}
              >
                {result?.scoreBefore} → {result?.scoreAfter}
              </span>
            </p>
          )}
          {result?.scoreNote && <p className="rx-current-note">{result.scoreNote}</p>}
        </div>

        {/* Caption + concept caption + play control */}
        <p className="rx-caption">{result?.caption ?? 'Choose a prescription and press Check prescription.'}</p>
        <div className="rx-concept">
          <span>Conceptual pathway · particle flow is illustrative</span>
          <PlayControl playing={playing} disabled={!animatable || reduceMotion} onToggle={onTogglePlay} />
        </div>

        {/* Ruler */}
        <Ruler result={result} />
      </div>
    </section>
  );
}

function Ruler({ result }: { result?: RxGeneResult }) {
  const byGenes = result?.baselineSpeed ?? null;
  const now = result?.currentSpeed ?? null;
  const stops: Array<'Slow' | 'Reduced' | 'Normal' | 'Fast'> = ['Slow', 'Reduced', 'Normal', 'Fast'];
  const level = result?.verdict.level;
  const nowColor = level === 'RED' ? 'var(--rx-coral)' : level === 'YELLOW' ? '#d98a2b' : 'var(--rx-marine)';

  return (
    <div className="rx-ruler">
      <div className="relative" style={{ height: u(20) }}>
        {now && now === byGenes && (
          <span className="absolute -translate-x-1/2 whitespace-nowrap font-semibold text-[var(--rx-ink)]" style={{ left: SPEED_X[now], fontSize: u(18) }}>
            By genes = now
          </span>
        )}
        {now && now !== byGenes && (
          <span className="absolute -translate-x-1/2 whitespace-nowrap font-semibold" style={{ left: SPEED_X[now], fontSize: u(18), color: nowColor }}>
            With medications
          </span>
        )}
        {byGenes && now !== byGenes && (
          <span className="absolute -translate-x-1/2 whitespace-nowrap font-semibold text-[var(--rx-ink)]" style={{ left: SPEED_X[byGenes], fontSize: u(18) }}>
            By genes
          </span>
        )}
      </div>
      <div className="relative" style={{ height: u(28), marginTop: u(0) }}>
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-[var(--rx-ink)]/25" style={{ height: 2 }} />
        {stops.map(s => (
          <span key={s} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--rx-ink)]/35" style={{ left: SPEED_X[s], width: 2, height: u(10) }} />
        ))}
        {now && (
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: SPEED_X[now], width: u(24), height: u(24), backgroundColor: nowColor, boxShadow: '0 0 0 3px #e6f4fb' }}
          />
        )}
        {byGenes && (
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-[var(--rx-ink)] bg-[#e6f4fb]"
            style={{ left: SPEED_X[byGenes], width: u(28), height: u(28) }}
          />
        )}
      </div>
      <div className="relative" style={{ height: u(24), marginTop: u(8) }}>
        {stops.map(s => (
          <span
            key={s}
            className={`absolute top-0 -translate-x-1/2 ${s === byGenes || s === now ? 'font-semibold text-[var(--rx-ink)]' : 'text-[var(--rx-ink-soft)]'}`}
            style={{ left: SPEED_X[s], fontSize: u(18) }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

function ControlSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const id = `rx-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const items = options.map(o => ({ value: o.value, label: o.label }));
  return (
    <div className="flex min-w-0 flex-col">
      <span id={id} className="rx-field-label">
        {label}
      </span>
      <Select items={items} value={value} onValueChange={v => typeof v === 'string' && onChange(v)}>
        <SelectTrigger
          aria-labelledby={id}
          className="rx-field-control w-full min-w-0 border-[var(--rx-control-border)] bg-white/80 px-3 font-semibold text-[var(--rx-ink)] focus-visible:ring-2 focus-visible:ring-[var(--rx-marine)]/60"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value} className="py-2">
              <span className="font-semibold">{o.label}</span>
              {o.detail && <span className="text-muted-foreground">{o.detail}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MedicationField({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const id = 'rx-current-medications';
  const selected = values[0] ?? null;
  const addable = options.filter(o => !values.includes(o.value));

  if (selected) {
    return (
      <div className="flex min-w-0 flex-col">
        <span id={id} className="rx-field-label">
          {label}
        </span>
        <div className="rx-field-control flex w-full items-center justify-between rounded-xl border border-[var(--rx-control-border)] bg-white/80 px-3">
          <span className="truncate font-semibold text-[var(--rx-ink)]">{labelFor(options, selected)}</span>
          <button
            type="button"
            aria-label={`Remove ${labelFor(options, selected)}`}
            className="rx-press -mr-1 flex size-8 items-center justify-center rounded-lg text-[var(--rx-ink)] hover:bg-[var(--rx-ink)]/5"
            onClick={() => onChange(values.filter(v => v !== selected))}
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <span id={id} className="rx-field-label">
        {label}
      </span>
      <Select items={addable.map(o => ({ value: o.value, label: o.label }))} value="" onValueChange={v => typeof v === 'string' && v && onChange([v])}>
        <SelectTrigger
          aria-labelledby={id}
          className="rx-field-control w-full min-w-0 border-[var(--rx-control-border)] bg-white/80 px-3 font-medium text-[var(--rx-ink)] focus-visible:ring-2 focus-visible:ring-[var(--rx-marine)]/60"
        >
          <span className="text-[var(--rx-ink-soft)]">Add medication</span>
        </SelectTrigger>
        <SelectContent>
          {addable.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * RxGeneUI — controlled, backend-agnostic
 * ------------------------------------------------------------------ */

export function RxGeneUI({
  patientOptions,
  patientValue,
  medicationOptions,
  medicationValues,
  prescriptionOptions,
  prescriptionValue,
  result,
  pending,
  playing,
  reduceMotion,
  onPatientChange,
  onMedicationsChange,
  onPrescriptionChange,
  onCheck,
  onReset,
  onEvidence,
  onExplanation,
  onReviewMedications,
  onTogglePlay,
}: RxGeneUIProps) {
  const verdict = result?.verdict;

  return (
    <div className="rx">
      <div className="rx-shell">
        {/* Header */}
        <header className="rx-header">
          <div className="flex items-center gap-4">
            <p className="rx-brand text-[var(--rx-ink)]">
              RxGene<span className="text-[var(--rx-coral)]">.</span>
            </p>
            <span aria-hidden="true" className="h-6 w-px bg-[var(--rx-ink)]/20" />
            <p className="rx-descriptor">Pharmacogenomics</p>
          </div>
          <div className="rx-header-right">
            <p className="rx-hitem font-semibold tracking-[0.2em] text-[var(--rx-ink-soft)]">SYNTHETIC DEMO</p>
            <span aria-hidden="true" className="h-6 w-px bg-[var(--rx-ink)]/20" />
            <button
              type="button"
              className="rx-press rx-hitem flex items-center rounded-lg px-3 font-medium text-[var(--rx-ink)] hover:bg-[var(--rx-ink)]/5 disabled:opacity-40"
              onClick={onEvidence}
              disabled={!result}
            >
              Evidence
            </button>
            <span aria-hidden="true" className="h-6 w-px bg-[var(--rx-ink)]/20" />
            <button
              type="button"
              className="rx-press rx-hitem flex items-center gap-2 rounded-lg px-3 font-medium text-[var(--rx-ink)] hover:bg-[var(--rx-ink)]/5"
              onClick={onReset}
            >
              <RotateCcw aria-hidden="true" className="size-5" strokeWidth={1.75} />
              Reset
            </button>
          </div>
        </header>

        {/* Control bar */}
        <section aria-label="Prescription check" className="rx-controls rx-glass">
          <ControlSelect label="Patient" value={patientValue} options={patientOptions} onChange={onPatientChange} />
          <MedicationField label="Current medications" options={medicationOptions} values={medicationValues} onChange={onMedicationsChange} />
          <ControlSelect label="Check prescription" value={prescriptionValue} options={prescriptionOptions} onChange={onPrescriptionChange} />
          <button
            type="button"
            onClick={onCheck}
            disabled={pending}
            aria-busy={pending || undefined}
            className="rx-check-btn rx-press flex items-center justify-center gap-2 bg-gradient-to-b from-[#1b5f86] to-[#0e3a52] font-semibold text-white shadow-[0_10px_28px_-12px_rgba(6,38,71,0.7)] disabled:opacity-60"
          >
            Check prescription
            <ArrowRight aria-hidden="true" className="size-6" strokeWidth={2} />
          </button>
        </section>

        {/* Title */}
        <div className="rx-title-block">
          <h1 className="rx-title text-[var(--rx-ink)]">Same genes. Different response.</h1>
          <p className="rx-subtitle">See how current medications change this prescription assessment.</p>
        </div>

        {/* Scene */}
        <Scene result={result} playing={playing} onTogglePlay={onTogglePlay} reduceMotion={reduceMotion} />

        {/* Verdict */}
        <section aria-label="Verdict" className="rx-verdict">
          <div className="rx-verdict-inner rx-verdict-grid">
            {verdict?.level === 'RED' || verdict?.level === 'YELLOW' ? (
              <TriangleAlert
                aria-hidden="true"
                className="rx-v-icon rx-v-row"
                strokeWidth={2}
                style={{ color: verdict.level === 'RED' ? 'var(--rx-coral)' : '#f0b45c' }}
              />
            ) : (
              <Info aria-hidden="true" className="rx-v-icon rx-v-row" strokeWidth={2} style={{ color: '#cfe4f0' }} />
            )}
            <p className="rx-v-kicker rx-v-row">{verdict?.kicker ?? 'Prescription review'}</p>
            <h2
              className="rx-v-headline rx-v-row"
              data-long={(verdict?.headline ?? 'Choose a prescription').length >= 17 || undefined}
              data-qualified={verdict?.qualifier ? true : undefined}
            >
              {verdict?.headline ?? 'Choose a prescription'}
            </h2>
            {verdict?.qualifier && <p className="rx-v-qualifier rx-v-row">{verdict.qualifier}</p>}
            <span className="rx-v-divider" aria-hidden="true" />
            <div className="rx-v-middle">
              <p className="rx-v-rationale rx-v-row">{verdict?.rationale ?? 'Press Check prescription to see the assessment.'}</p>
              {verdict?.source && <p className="rx-v-source rx-v-row">{verdict.source}</p>}
            </div>
            <button
              type="button"
              onClick={onReviewMedications}
              disabled={!result}
              className="rx-v-evidence rx-press rx-v-row flex items-center justify-center gap-2 bg-[#dceff8] font-semibold text-[var(--rx-ink)] hover:bg-white disabled:opacity-40"
            >
              Review full medication list
              <ArrowUpRight aria-hidden="true" className="size-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onExplanation}
              disabled={!verdict?.explanationAvailable}
              className="rx-v-explain rx-press rx-v-row flex items-center gap-2 font-semibold text-white underline underline-offset-4 hover:bg-white/10 disabled:no-underline disabled:opacity-40"
            >
              Patient explanation
              <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2} />
            </button>
            <p className="rx-v-footer rx-v-row">Hackathon prototype · Synthetic data only · For clinician review</p>
          </div>
        </section>
      </div>
    </div>
  );
}
