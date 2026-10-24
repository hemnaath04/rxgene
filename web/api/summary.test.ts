// /api/summary tests with a mocked fetch (build spec section 6, R33-R37).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './summary';
import { LLM_TIMEOUT_MS, MAX_TOKENS, RATE_LIMIT, resetLlmState, validate } from './_lib/llm';
import { checkOrder } from '../src/engine/index';
import type { DrugAssessment, Patient } from '../src/engine/index';
import { renderTemplate } from '../src/engine/templates';
import type { SummaryLang } from '../src/engine/templates';
import expectedOutputs from '../../tests/fixtures/expected_outputs.json';

type Body = { text: string; source: 'ai' | 'template'; rateLimited?: boolean };

/** P01: genotype normal, fluoxetine -> poor metabolizer, codeine RED. */
function redAssessment(): DrugAssessment {
  const patient: Patient = { id: 'P01', name: 'P01', cyp2d6: '*1/*1', meds: ['fluoxetine'] };
  const a = checkOrder(patient, 'codeine').find(x => x.drug === 'codeine');
  if (!a) throw new Error('no codeine assessment');
  return a;
}

const VALID_RED =
  "Codeine is not recommended for you right now. Fluoxetine jams your liver's cleanup crew, so your body clears this drug slowly. It may not work to relieve your pain. Your care team will talk with you about other options.";

function llmResponse(content: string): Response {
  return Response.json({ choices: [{ message: { role: 'assistant', content } }] });
}

function mockLlm(content: string) {
  const fetchMock = vi.fn(() => Promise.resolve(llmResponse(content)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function summaryRequest(assessment: DrugAssessment, lang: SummaryLang = 'en', ip = '203.0.113.7'): Request {
  return new Request('http://localhost/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify({ assessment, lang })
  });
}

async function summarize(assessment: DrugAssessment, lang: SummaryLang = 'en', ip?: string): Promise<Body> {
  const res = await POST(summaryRequest(assessment, lang, ip));
  expect(res.status).toBe(200);
  return (await res.json()) as Body;
}

beforeEach(() => {
  resetLlmState();
  vi.stubEnv('LLM_BASE_URL', 'https://llm.example.test/v1');
  vi.stubEnv('LLM_API_KEY', 'test-key');
  vi.stubEnv('LLM_MODEL', 'test-model');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/summary', () => {
  it('returns a valid AI text with source "ai"', async () => {
    const fetchMock = mockLlm(VALID_RED);
    const body = await summarize(redAssessment());

    expect(body).toEqual({ text: VALID_RED, source: 'ai' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://llm.example.test/v1/chat/completions');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-key');
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({ model: 'test-model', max_tokens: MAX_TOKENS });
    expect(sent).not.toHaveProperty('temperature');
  });

  it('serves a repeat request from the cache', async () => {
    const fetchMock = mockLlm(VALID_RED);
    await summarize(redAssessment());
    const body = await summarize(redAssessment());
    expect(body.source).toBe('ai');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the template when the text drops "avoid"', async () => {
    mockLlm("Codeine may help your pain. Fluoxetine jams your liver's cleanup crew, so your body clears this drug slowly.");
    const a = redAssessment();
    expect(await summarize(a)).toEqual({ text: renderTemplate(a, 'en'), source: 'template' });
  });

  it('falls back to the template when the text adds a new drug name', async () => {
    mockLlm(`${VALID_RED} Your doctor may give you morphine instead.`);
    const a = redAssessment();
    expect(await summarize(a)).toEqual({ text: renderTemplate(a, 'en'), source: 'template' });
  });

  it('falls back to the template when the text contains "safe"', async () => {
    mockLlm(`${VALID_RED} Other pain medicines are safe for you.`);
    const a = redAssessment();
    expect(await summarize(a)).toEqual({ text: renderTemplate(a, 'en'), source: 'template' });
  });

  it('falls back to the template when the LLM takes 7 s (6 s timeout)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(llmResponse(VALID_RED)), 7000);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const a = redAssessment();
    const pending = POST(summaryRequest(a));
    await vi.advanceTimersByTimeAsync(LLM_TIMEOUT_MS + 1);
    const body = (await (await pending).json()) as Body;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ text: renderTemplate(a, 'en'), source: 'template' });
  });

  it('rate-limits the 21st call in a minute from one IP', async () => {
    mockLlm(VALID_RED);
    const a = redAssessment();
    for (let i = 0; i < RATE_LIMIT; i++) {
      const body = await summarize(a, 'en', '198.51.100.1');
      expect(body.rateLimited).toBeUndefined();
    }
    const limited = await summarize(a, 'en', '198.51.100.1');
    expect(limited).toEqual({ text: renderTemplate(a, 'en'), source: 'template', rateLimited: true });

    // Another IP is unaffected
    expect((await summarize(a, 'en', '198.51.100.2')).rateLimited).toBeUndefined();
  });

  it('returns the template with no network call when the LLM env vars are missing', async () => {
    vi.stubEnv('LLM_BASE_URL', '');
    vi.stubEnv('LLM_API_KEY', '');
    vi.stubEnv('LLM_MODEL', '');
    const fetchMock = mockLlm(VALID_RED);
    const a = redAssessment();
    expect(await summarize(a, 'es')).toEqual({ text: renderTemplate(a, 'es'), source: 'template' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a body without an assessment', async () => {
    const res = await POST(
      new Request('http://localhost/api/summary', { method: 'POST', body: JSON.stringify({ lang: 'en' }) })
    );
    expect(res.status).toBe(400);
  });
});

const MODELS = 'anthropic/claude-sonnet-5-subscription,anthropic/claude-sonnet-5-5-subscription';

/** P14: *4/*4, atomoxetine YELLOW; the recommendation contains 40, 2, 80, 4, 200 and 400. */
function atomoxetineAssessment(): DrugAssessment {
  const patient: Patient = { id: 'P14', name: 'P14', cyp2d6: '*4/*4', meds: [] };
  const a = checkOrder(patient, 'atomoxetine').find(x => x.drug === 'atomoxetine');
  if (!a) throw new Error('no atomoxetine assessment');
  return a;
}

const VALID_ATOMOXETINE =
  'For atomoxetine, your prescriber will start with a dose of 40 mg a day. If it does not help after 2 weeks and you have no bad effects, the dose may go up to 80 mg a day. If it still does not help after 2 weeks, a blood test 2 to 4 hours after a dose can check the level. If the level is under 200 ng/mL, the dose may be raised to get near 400 ng/mL.';
const MISSING_80 = VALID_ATOMOXETINE.replace('up to 80 mg a day', 'up');
const MANIFEST_ERROR = '[🦚 Manifest M102] anthropic subscription credentials could not be refreshed…';

/** One mocked LLM answer per call, in order. */
function mockSequence(...contents: string[]) {
  const fetchMock = vi.fn();
  for (const c of contents) fetchMock.mockImplementationOnce(() => Promise.resolve(llmResponse(c)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe('model fallback list', () => {
  beforeEach(() => vi.stubEnv('LLM_MODEL', MODELS));

  it('sends no temperature to any model', async () => {
    const fetchMock = mockSequence(MANIFEST_ERROR, VALID_RED);
    await summarize(redAssessment());
    for (const call of [0, 1]) expect(sentBody(fetchMock, call)).not.toHaveProperty('temperature');
  });

  it('uses the second model when the first returns a Manifest error with HTTP 200', async () => {
    const fetchMock = mockSequence(MANIFEST_ERROR, VALID_RED);
    expect(await summarize(redAssessment())).toEqual({ text: VALID_RED, source: 'ai' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 0).model).toBe('anthropic/claude-sonnet-5-subscription');
    expect(sentBody(fetchMock, 1).model).toBe('anthropic/claude-sonnet-5-5-subscription');
  });

  it('moves on to the next model when the text drops "80" from the recommendation', async () => {
    const a = atomoxetineAssessment();
    expect(validate(MISSING_80, a, 'en')).toEqual({ ok: false, reason: 'recommendation number missing' });
    expect(validate(VALID_ATOMOXETINE, a, 'en')).toEqual({ ok: true });

    const fetchMock = mockSequence(MISSING_80, VALID_ATOMOXETINE);
    expect(await summarize(a)).toEqual({ text: VALID_ATOMOXETINE, source: 'ai' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('strips Markdown before validating', async () => {
    mockSequence(`**${VALID_RED}**`);
    expect((await summarize(redAssessment())).text).toBe(VALID_RED);
  });

  it('returns the template when both models fail', async () => {
    const fetchMock = mockSequence(MANIFEST_ERROR, MISSING_80);
    const a = atomoxetineAssessment();
    expect(await summarize(a)).toEqual({ text: renderTemplate(a, 'en'), source: 'template' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects genotype, phenotype, metabolizer and gene names (EN and ES)', () => {
    const a = redAssessment();
    const rejected = [
      `${VALID_RED} Your genotype is normal.`,
      `${VALID_RED} Your phenotype changed.`,
      `${VALID_RED} You act like a poor metabolizer.`,
      `${VALID_RED} Fluoxetine blocks CYP2D6.`,
      `${VALID_RED} This is about CYP2C19.`,
    ];
    for (const text of rejected) {
      expect(validate(text, a, 'en')).toEqual({ ok: false, reason: 'technical term' });
    }
    expect(validate('No se recomienda codeína. Usted es un metabolizador lento.', a, 'es')).toEqual({
      ok: false,
      reason: 'technical term',
    });
    expect(validate(VALID_RED, a, 'en')).toEqual({ ok: true });
  });

  it('moves on to the next model when the text uses "metabolizer", then to the template', async () => {
    const a = redAssessment();
    const withTerm = `${VALID_RED} You act like a poor metabolizer.`;

    const fetchMock = mockSequence(withTerm, VALID_RED);
    expect(await summarize(a)).toEqual({ text: VALID_RED, source: 'ai' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resetLlmState();
    const both = mockSequence(withTerm, `${VALID_RED} Fluoxetine blocks CYP2D6.`);
    expect(await summarize(a)).toEqual({ text: renderTemplate(a, 'en'), source: 'template' });
    expect(both).toHaveBeenCalledTimes(2);
  });
});

describe('templates', () => {
  // Every engine output for the 22 fixtures, in both languages, must pass the same validator
  // the AI text goes through. Exception: the templates deliberately carry no numbers, so the
  // "keep every recommendation number" rule (AI text only) is allowed to fail here.
  const assessments = expectedOutputs.flatMap(fixture => {
    const patient: Patient = {
      id: fixture.id,
      name: fixture.id,
      cyp2d6: fixture.cyp2d6 || undefined,
      cyp2c19: fixture.cyp2c19 || undefined,
      meds: fixture.current_meds ? fixture.current_meds.split(',').map(m => m.trim()).filter(m => m) : []
    };
    return checkOrder(patient, fixture.new_drug).map(a => ({ id: fixture.id, a }));
  });

  for (const lang of ['en', 'es'] as const) {
    it(`pass validation for every fixture assessment (${lang})`, () => {
      for (const { id, a } of assessments) {
        const text = renderTemplate(a, lang);
        const result = validate(text, a, lang);
        const ok = result.ok || result.reason === 'recommendation number missing';
        expect({ id, drug: a.drug, alert: a.alert, ok, result }).toMatchObject({
          id,
          drug: a.drug,
          alert: a.alert,
          ok: true
        });
      }
    });
  }
});
