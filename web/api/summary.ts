// POST /api/summary: plain-language patient summary (build spec section 6, R33-R37).
// Body: { assessment: DrugAssessment, lang: 'en' | 'es' }
// Returns: { text, source: 'ai' | 'template', rateLimited?: true }
// The AI only rewrites the engine's output. Missing env vars, an LLM error, a timeout or a
// failed validation all return the fixed template. Never log the key or the prompt.
import { renderTemplate } from '../src/engine/templates';
import type { SummaryLang } from '../src/engine/templates';
import type { Alert, DrugAssessment } from '../src/engine/types';
import {
  buildMessages,
  cacheGet,
  cacheKey,
  cacheSet,
  callLlm,
  clientIp,
  isRateLimited,
  llmConfig,
  validate
} from './_lib/llm';

export type SummaryResponse = { text: string; source: 'ai' | 'template'; rateLimited?: boolean };

const ALERTS: Alert[] = ['RED', 'YELLOW', 'GREEN', 'GREY'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Shape check for the fields the template and validator read. */
function isAssessment(v: unknown): v is DrugAssessment {
  if (!isObject(v)) return false;
  const inhibitorOk =
    v.inhibitor === null ||
    v.inhibitor === undefined ||
    (isObject(v.inhibitor) && typeof v.inhibitor.drug === 'string');
  return (
    typeof v.drug === 'string' &&
    v.drug.trim() !== '' &&
    typeof v.alert === 'string' &&
    ALERTS.includes(v.alert as Alert) &&
    typeof v.recommendation === 'string' &&
    typeof v.genotypePhenotype === 'string' &&
    typeof v.adjustedPhenotype === 'string' &&
    inhibitorOk &&
    (v.inhibitorNote === undefined || typeof v.inhibitorNote === 'string')
  );
}

const badRequest = (error: string) => Response.json({ error }, { status: 400 });

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }
  if (!isObject(body) || !isAssessment(body.assessment)) {
    return badRequest('Body must be { assessment: DrugAssessment, lang: "en" | "es" }');
  }
  const assessment = body.assessment;
  const lang: SummaryLang = body.lang === 'es' ? 'es' : 'en';
  const template = (extra: Partial<SummaryResponse> = {}) =>
    Response.json({ text: renderTemplate(assessment, lang), source: 'template', ...extra } satisfies SummaryResponse);

  // No LLM configured: template immediately, no network call.
  if (!llmConfig()) return template();

  if (isRateLimited(clientIp(request))) return template({ rateLimited: true });

  const key = cacheKey(assessment, lang);
  const cached = cacheGet(key);
  if (cached) return Response.json({ text: cached, source: 'ai' } satisfies SummaryResponse);

  try {
    const text = await callLlm(buildMessages(assessment, lang));
    const result = validate(text, assessment, lang);
    if (!result.ok) {
      console.warn(`[summary] AI text rejected (${result.reason}); using template`);
      return template();
    }
    cacheSet(key, text);
    return Response.json({ text, source: 'ai' } satisfies SummaryResponse);
  } catch (err) {
    // Message only (e.g. "LLM timeout", "LLM HTTP 500"); never the key or the prompt.
    console.warn(`[summary] LLM call failed (${err instanceof Error ? err.message : 'unknown'}); using template`);
    return template();
  }
}
