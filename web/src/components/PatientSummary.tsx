import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { renderTemplate } from '@/engine/templates';
import type { SummaryLang } from '@/engine/templates';
import type { DrugAssessment } from '@/engine/types';

type Summary = { text: string; source: 'ai' | 'template'; rateLimited?: boolean };

const LANGS: Array<{ value: SummaryLang; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

const SOURCE_LABEL: Record<Summary['source'], string> = {
  ai: 'AI-written from rule output',
  template: 'Template',
};

const MACHINE_TRANSLATED = 'Machine-translated: review before giving to patient.';

/**
 * Server answers keyed by `${lang}:${assessment JSON}`. Module-level so closing and reopening
 * the explanation sheet (which unmounts this component) doesn't re-request or use rate limit.
 */
const answerCache = new Map<string, Summary>();

function isSummary(v: unknown): v is Summary {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.text === 'string' && s.text.trim() !== '' && (s.source === 'ai' || s.source === 'template');
}

type PatientSummaryProps = {
  assessment: DrugAssessment;
  /** Starting tab (from ?lang=). */
  initialLang?: SummaryLang;
};

/**
 * Plain-language patient summary (R36/R37). Shows the fixed template at once, then the
 * server's answer from /api/summary (AI text that passed validation, or the template).
 */
export function PatientSummary({ assessment, initialLang = 'en' }: PatientSummaryProps) {
  const [lang, setLang] = useState<SummaryLang>(initialLang);
  const [answers, setAnswers] = useState<Record<string, Summary>>(() => Object.fromEntries(answerCache));
  // Requests that ended without a usable answer (network error, non-2xx): stop "Writing…".
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  // Answers already cached when this component mounted appear without a fade.
  const [preloaded] = useState(() => new Set(answerCache.keys()));

  const assessmentJson = useMemo(() => JSON.stringify(assessment), [assessment]);
  const answerKey = `${lang}:${assessmentJson}`;

  useEffect(() => {
    const key = `${lang}:${assessmentJson}`;
    if (answerCache.has(key)) return;
    const controller = new AbortController();
    const markFailed = () => setFailed(prev => new Set(prev).add(key));
    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment: JSON.parse(assessmentJson), lang }),
      signal: controller.signal,
    })
      .then(res => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (!isSummary(data)) return markFailed();
        answerCache.set(key, data);
        setAnswers(prev => ({ ...prev, [key]: data }));
      })
      .catch(() => {
        // Network error: the local template stays on screen. Abort: the component moved on.
        if (!controller.signal.aborted) markFailed();
      });
    return () => controller.abort();
  }, [lang, assessmentJson]);

  const answer: Summary | undefined = answers[answerKey] ?? answerCache.get(answerKey);
  const templateText = renderTemplate(assessment, lang);
  const aiText = answer?.source === 'ai' ? answer.text : null;
  const pending = !answer && !failed.has(answerKey);
  const fade = aiText !== null && !preloaded.has(answerKey);

  return (
    <Tabs value={lang} onValueChange={value => setLang(value === 'es' ? 'es' : 'en')}>
      <TabsList aria-label="Summary language" className="h-10!">
        {LANGS.map(l => (
          <TabsTrigger key={l.value} value={l.value} className="px-4 text-base">
            {l.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {LANGS.map(l => (
        <TabsContent key={l.value} value={l.value}>
          {l.value === lang && (
            <div aria-live="polite" className="flex flex-col gap-3 pt-2">
              {/* Template and AI text share one grid cell, so the swap doesn't shift the layout. */}
              <div className="grid">
                <p
                  lang={lang}
                  aria-hidden={aiText !== null}
                  className={`col-start-1 row-start-1 text-lg/7 text-ink transition-opacity duration-200 motion-reduce:transition-none ${aiText !== null ? 'opacity-0' : 'opacity-100'}`}
                >
                  {templateText}
                </p>
                {aiText !== null && (
                  <p
                    key={answerKey}
                    lang={lang}
                    className={`col-start-1 row-start-1 text-lg/7 text-ink ${fade ? 'animate-in fade-in duration-200 motion-reduce:animate-none' : ''}`}
                  >
                    {aiText}
                  </p>
                )}
              </div>
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <Badge variant="outline" className="h-6 px-2.5">
                  {SOURCE_LABEL[aiText !== null ? 'ai' : 'template']}
                </Badge>
                {pending && <span>Writing a plain-language version…</span>}
                {answer?.rateLimited && 'AI summary limit reached; showing the template.'}
              </p>
              {lang === 'es' && aiText !== null && (
                <p role="note" className="text-sm font-medium text-ink">
                  {MACHINE_TRANSLATED}
                </p>
              )}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
