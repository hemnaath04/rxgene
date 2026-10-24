import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import { AlertCard, MismatchWarning, ViaBadge } from '@/components/AlertCard';
import { LevelChip } from '@/components/AlertLevel';
import { CdsExchangePanel } from '@/components/CdsExchangePanel';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import inhibitors from '@/data/inhibitors.json';
import pairReports from '@/data/openfda/pair_reports.json';
import { toCdsCard } from '@/engine/cdsCard';
import { ATOMOXETINE_AS1_CONTROVERSY_NOTE } from '@/engine/fixedTexts';
import type { CdsCard, DrugAssessment } from '@/engine/types';
import type { CardEntry } from '@/lib/cardEntries';
import type { CdsExchange, OrderSelectRequest } from '@/lib/cdsClient';
import { enterExit } from '@/lib/motion';
import { reportsFor } from '@/lib/openfda';
import { REQUIREMENT_TITLES, requirementsFor } from '@/lib/requirements';
import { capitalize, formatScore, parseSourceLinks, populationLine, sourceLine, toVerdict } from '@/lib/verdict';
import type { Mode } from '@/lib/url';

type EvidenceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All entries of the check, most severe first. */
  entries: CardEntry[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Full medication list of the check (for R13). */
  meds: string[];
  mode: Mode;
  exchange: { request: OrderSelectRequest; result: CdsExchange | null } | null;
};

const THRESHOLDS =
  'Current standardized CYP2D6 thresholds: activity score 0 = poor; above 0 and below 1.25 = intermediate; 1.25 to 2.25 = normal; above 2.25 = ultrarapid.';

const OLD_ATOMOXETINE_NOTE =
  'The 2019 CPIC atomoxetine guideline used an older convention (for example, activity score 1.0 was grouped with normal metabolizers). RxGene uses the current thresholds and looks atomoxetine up by activity score, so phenotype labels here can differ from that guideline.';

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_1fr] gap-3 border-b border-ink/10 py-2 last:border-b-0">
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function phenoconversionText(a: DrugAssessment): string {
  if (a.phenoconverted === true) return "Yes: another medicine changed how this patient's genes work.";
  if (a.phenoconverted === false) return 'No';
  return 'Not computed';
}

/** R38: CPIC text is labeled verbatim; a GREY fixed text (R7/R8/R18) is labeled as RxGene's own. */
function recommendationTitle(a: DrugAssessment): string {
  if (a.alert === 'GREY' && !a.strength) return 'RxGene result (fixed text; no CPIC recommendation applied)';
  if (a.cpicRole) return 'CPIC recommendation (supporting context, verbatim and in full)';
  return 'CPIC recommendation (verbatim and in full)';
}

/**
 * Real-world reports panel (openFDA FAERS). Subordinate to CPIC evidence.
 * Shows matching drug+co-medication pairs from the snapshot, with disclaimers.
 * No matching pair -> no panel rendered.
 */
export function OpenFDAPanel({ drug, meds }: { drug: string; meds: string[] }) {
  const reports = reportsFor(drug, meds);

  // No matching pairs: render nothing
  if (reports.length === 0) {
    return null;
  }

  return (
    <Section title="Real-world reports (openFDA FAERS)">
      <div className="flex flex-col gap-4">
        {reports.map((report) => (
          <div key={report.query} className="rounded-lg border border-ink/15 bg-ink/5 px-4 py-3">
            <p className="text-sm leading-relaxed text-ink">
              {report.totalReports} reports submitted to FDA list both{' '}
              <span className="font-semibold">{capitalize(report.drug)}</span> and{' '}
              <span className="font-semibold">{capitalize(report.coMedication)}</span>, in any role. Reporters coded{' '}
              <span className="font-semibold">{report.reactionReports['DRUG_INTERACTION'] ?? 0}</span> as "drug
              interaction" and <span className="font-semibold">{report.reactionReports['DRUG_INEFFECTIVE'] ?? 0}</span>{' '}
              as "drug ineffective"; these terms do not identify which medicine they refer to.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              A report does not establish that either medicine caused an event, and FAERS is not a complete record of
              adverse events. Counts are not compared between medication pairs. RxGene's clinical rules do not use these
              reports.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Do not rely on openFDA to make decisions regarding medical care. Results are unvalidated.
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Data retrieved: {pairReports.fetched}.{' '}
              <a
                href={report.query}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 break-all underline underline-offset-1"
              >
                Source <ExternalLink aria-hidden="true" className="size-2.5 shrink-0" strokeWidth={1.5} />
              </a>
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AssessmentEvidence({ a, meds }: { a: DrugAssessment; meds: string[] }) {
  const g = formatScore(a.genotypeActivityScore);
  const adj = a.adjustedActivityScoreLabel ?? formatScore(a.adjustedActivityScore);
  const ids = requirementsFor(a, meds);
  const population = populationLine(a)?.replace(/^Population: /, '') ?? null;
  const links = parseSourceLinks(a.sourceLinks);
  const showAs1Note =
    a.drug === 'atomoxetine' && a.genotypeActivityScore !== null && Math.abs(a.genotypeActivityScore - 1) < 1e-9;

  return (
    <>
      {/* R17: FDA label recommendation applies directly to strong-inhibitor coadministration; lead with it. */}
      {a.labelRecommendation && (
        <Section title="FDA label (applies directly)">
          <p className="text-base text-ink">{a.labelRecommendation}</p>
          {a.discrepancyFlag && (
            <p className="rounded-lg bg-alert-amber/10 px-3 py-2 text-sm text-ink">{a.discrepancyFlag}</p>
          )}
        </Section>
      )}

      {/* R28: the label interaction, separate from the genotype result. */}
      {a.labelNote && (
        <Section title="Label interaction">
          <p className="rounded-lg border border-ink/25 bg-ink/5 px-3 py-2 text-base font-medium text-ink">{a.labelNote}</p>
        </Section>
      )}

      <Section title="Rule inputs and result">
        <dl>
          <Row term="Gene result (diplotype)">
            {a.gene} {a.genotype ?? 'none on file'}
          </Row>
          <Row term="Activity score (genotype → adjusted)">
            {a.gene === 'CYP2C19'
              ? 'Not used (CYP2C19 phenotype comes from the diplotype)'
              : g === null
                ? 'Not computed'
                : `${g} → ${adj ?? 'not computed'}`}
          </Row>
          <Row term="Phenotype by genes">{a.genotypePhenotype}</Row>
          <Row term="Phenotype with current medications">
            {a.adjustedPhenotype === 'not computed' ? 'Not computed (pharmacist review)' : a.adjustedPhenotype}
          </Row>
          <Row term="Phenoconversion">{phenoconversionText(a)}</Row>
          <Row term="Inhibitor (FDA class)">
            {a.inhibitor ? (
              <>
                {capitalize(a.inhibitor.drug)}: {a.inhibitor.strength} CYP2D6 inhibitor (
                <a className="underline underline-offset-2" href={inhibitors._source} target="_blank" rel="noreferrer">
                  FDA table
                </a>
                , verified {inhibitors._verified})
              </>
            ) : (
              'None strong or moderate on the list'
            )}
          </Row>
          {a.confidence === 'reduced' && (
            <Row term="Confidence">
              Reduced: ultrarapid metabolizers may not phenoconvert to the same extent (CPIC 2023).
            </Row>
          )}
          {a.triggeredBy !== a.drug && <Row term="Re-checked because">{a.triggeredBy} was added</Row>}
          {a.inhibitorNote && <Row term="Inhibitor note">{a.inhibitorNote}</Row>}
        </dl>
      </Section>

      <Section title={recommendationTitle(a)}>
        {/* R38: verbatim and in full, every condition kept; never shortened or paraphrased. */}
        <blockquote className="border-l-4 border-ink/30 pl-3 text-base whitespace-pre-line break-words text-ink">
          {a.recommendation || 'No recommendation text (see the data error).'}
        </blockquote>
        {/* R17: the CPIC poor-metabolizer text is supporting genotype-based context only. */}
        {a.cpicRole && <p className="text-sm text-ink-muted">{a.cpicRole}</p>}
        {/* R20: the genotype (unconverted) recommendation, shown alongside the converted one. */}
        {a.genotypeRecommendation && (
          <>
            <p className="text-sm font-semibold text-ink">Genotype (unconverted) recommendation</p>
            <blockquote className="border-l-4 border-ink/30 pl-3 text-base text-ink">{a.genotypeRecommendation}</blockquote>
          </>
        )}
        <dl>
          <Row term="Strength">{a.strength || 'None given'}</Row>
          {sourceLine(a) && <Row term="Guideline version">{sourceLine(a)}</Row>}
          {/* R26/R27/R17: the population used stays visible. */}
          {population && <Row term="Population">{population}</Row>}
          <Row term="Guideline">
            {a.source.guideline ? (
              a.source.url ? (
                <a
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                  href={a.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  CPIC {a.source.guideline}
                  <ExternalLink aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
                </a>
              ) : (
                `CPIC ${a.source.guideline}`
              )
            ) : (
              'None'
            )}
          </Row>
          <Row term="Fetched">{a.source.fetched || 'Not available'}</Row>
        </dl>
        {/* R17: FDA label + CPIC source links and versions. */}
        {links.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-ink">Sources</p>
            <ul className="flex flex-col gap-1 text-xs break-words text-ink-muted">
              {links.map(link => (
                <li key={link.label}>
                  {link.label}
                  {link.url && (
                    <>
                      {': '}
                      <a className="break-all underline underline-offset-2" href={link.url} target="_blank" rel="noreferrer">
                        {link.url}
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* R44: CPIC's "controversy remains" note for atomoxetine at activity score 1.0. */}
        {showAs1Note && <p className="rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink">{ATOMOXETINE_AS1_CONTROVERSY_NOTE}</p>}
      </Section>

      {a.gene === 'CYP2D6' && (
        <Section title="Thresholds">
          <p className="text-sm text-ink">{THRESHOLDS}</p>
          {ids.includes('R40') && (
            <p className="text-sm text-ink">
              <span className="font-semibold">R40:</span> {OLD_ATOMOXETINE_NOTE}
            </p>
          )}
        </Section>
      )}

      <Section title="Requirements behind this alert">
        <ul className="flex flex-col gap-1.5">
          {ids.map(id => (
            <li key={id} className="flex gap-2 text-sm text-ink">
              <span className="w-10 shrink-0 font-mono font-semibold">{id}</span>
              <span>{REQUIREMENT_TITLES[id] ?? ''}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-muted">From .kiro/specs/rxgene-engine/requirements.md, derived from the assessment.</p>
      </Section>

      <OpenFDAPanel drug={a.drug} meds={meds} />

      <CardJson card={toCdsCard(a)} label="CDS Hooks card JSON (built by the engine's toCdsCard)" />
    </>
  );
}

function CardJson({ card, label }: { card: CdsCard; label: string }) {
  return (
    <details className="rounded-lg border border-ink/15 bg-panel-solid">
      <summary className="cursor-pointer px-4 py-3 text-base font-semibold text-ink">{label}</summary>
      <pre
        tabIndex={0}
        className="mx-4 mb-4 max-h-80 overflow-auto overscroll-contain rounded-lg bg-ink/5 p-3 font-mono text-xs leading-5 text-ink"
      >
        {JSON.stringify(card, null, 2)}
      </pre>
    </details>
  );
}

/**
 * Technical evidence (DESIGN.md section 3): diplotype, activity scores, phenotypes, inhibitor
 * class, CPIC text verbatim, strength, link, fetch date, requirement IDs, R40 note, card JSON,
 * and in EHR mode the CDS Hooks request/response with latency.
 */
export function EvidenceSheet({ open, onOpenChange, entries, selectedKey, onSelect, meds, mode, exchange }: EvidenceSheetProps) {
  const reduce = !!useReducedMotion();
  const verdicts = entries.map(toVerdict);
  const selected = verdicts.find(v => v.key === selectedKey) ?? verdicts[0] ?? null;
  const selectedEntry = entries.find(e => e.key === selected?.key) ?? null;
  const cdsOnly = selectedEntry && selectedEntry.kind === 'cds-only' ? selectedEntry : null;

  return (
    <Sheet open={open} onOpenChange={next => onOpenChange(next)}>
      <SheetContent
        side="right"
        className="overflow-y-auto overscroll-contain bg-panel-solid data-[side=right]:w-[min(480px,100vw)]! data-[side=right]:max-w-none!"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-xl font-semibold text-ink">Evidence</SheetTitle>
          <SheetDescription className="text-base text-ink-muted">
            The technical detail behind the alert. Synthetic data only.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 pb-8">
          {verdicts.length > 1 && (
            <Section title={`Alerts in this check (${verdicts.length})`}>
              <ul className="relative flex flex-col gap-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {verdicts.map(v => (
                    <motion.li key={v.key} {...enterExit(reduce)}>
                      <AlertCard verdict={v} selected={v.key === selected?.key} onSelect={() => onSelect(v.key)} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </Section>
          )}

          {selected ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <LevelChip level={selected.level} />
                  <ViaBadge via={selected.via} />
                </div>
                <p className="text-lg font-semibold break-words text-ink">
                  {capitalize(selected.drug)}: {selected.headline}
                </p>
                {/* R31: GREEN is the genotype result only, not an overall medication clearance. */}
                {selected.qualifier && <p className="text-base text-ink">{selected.qualifier}</p>}
                {selected.mismatch && <MismatchWarning text={selected.mismatch} className="text-alert-red-text" />}
              </div>

              {selected.assessment ? (
                <AssessmentEvidence a={selected.assessment} meds={meds} />
              ) : cdsOnly ? (
                <>
                  <p className="text-sm whitespace-pre-wrap text-ink">{cdsOnly.card.detail}</p>
                  <CardJson card={cdsOnly.card} label="CDS Hooks card JSON (as returned by the service)" />
                </>
              ) : (
                <p className="text-base text-ink">
                  RxGene has no CPIC guideline for {selected.drug}, so there is no recommendation and no card. Requirement:
                  R32 (not assessed → GREY).
                </p>
              )}
            </>
          ) : (
            <p className="text-base text-ink">Run a check to see the evidence.</p>
          )}

          {mode === 'ehr' && exchange && (
            <Section title="CDS Hooks call">
              <CdsExchangePanel request={exchange.request} result={exchange.result} />
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
