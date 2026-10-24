import { useEffect, useMemo, useRef, useState } from 'react';
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

function isSummary(v: unknown): v is Summary {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.text === 'string' && s.text.trim() !== '' && (s.source === 'ai' || s.source === 'template');
}

/**
 * Plain-language patient summary (R36/R37). Shows the fixed template at once, then the
 * server's answer from /api/summary (AI text that passed validation, or the template).
 */
export function PatientSummary({ assessment }: { assessment: DrugAssessment }) {
  const [lang, setLang] = useState<SummaryLang>('en');
  // Server answers keyed by `${lang}:${assessment JSON}`
  const [answers, setAnswers] = useState<Record<string, Summary>>({});

  const assessmentJson = useMemo(() => JSON.stringify(assessment), [assessment]);
  const answerKey = `${lang}:${assessmentJson}`;

  // Keys already answered, so switching tabs back doesn't re-request (and use rate limit).
  const answered = useRef(new Set<string>());

  useEffect(() => {
    const key = `${lang}:${assessmentJson}`;
    if (answered.current.has(key)) return;
    const controller = new AbortController();
    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment: JSON.parse(assessmentJson), lang }),
      signal: controller.signal,
    })
      .then(res => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (!isSummary(data)) return;
        answered.current.add(key);
        setAnswers(prev => ({ ...prev, [key]: data }));
      })
      .catch(() => {
        // Network error or abort: the local template stays on screen.
      });
    return () => controller.abort();
  }, [lang, assessmentJson]);

  const shown: Summary = answers[answerKey] ?? { text: renderTemplate(assessment, lang), source: 'template' };

  return (
    <section aria-label="Patient summary">
      <h3>Patient summary</h3>
      <Tabs value={lang} onValueChange={value => setLang(value === 'es' ? 'es' : 'en')}>
        <TabsList aria-label="Summary language">
          {LANGS.map(l => (
            <TabsTrigger key={l.value} value={l.value}>
              {l.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {LANGS.map(l => (
          <TabsContent key={l.value} value={l.value}>
            {l.value === lang && (
              <div aria-live="polite">
                <p lang={lang}>{shown.text}</p>
                <p>
                  <Badge variant="outline">{SOURCE_LABEL[shown.source]}</Badge>
                  {shown.rateLimited && ' AI summary limit reached; showing the template.'}
                </p>
                {lang === 'es' && shown.source === 'ai' && <p role="note">{MACHINE_TRANSLATED}</p>}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
