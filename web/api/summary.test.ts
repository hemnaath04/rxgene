// /api/summary tests with a mocked fetch (build spec section 6, R33-R37).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './summary';
import { LLM_TIMEOUT_MS, RATE_LIMIT, resetLlmState, validate } from './_lib/llm';
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
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'test-model', temperature: 0, max_tokens: 220 });
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

describe('templates', () => {
  // Every engine output for the 22 fixtures, in both languages, must pass the same validator
  // the AI text goes through.
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
        expect({ id, drug: a.drug, alert: a.alert, result: validate(text, a, lang) }).toEqual({
          id,
          drug: a.drug,
          alert: a.alert,
          result: { ok: true }
        });
      }
    });
  }
});
