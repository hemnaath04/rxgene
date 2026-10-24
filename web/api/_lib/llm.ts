// LLM layer for the plain-language summary (architecture spec section 5, build spec section 6).
// Server-only. The AI rewrites the engine's output; it never decides anything (R34).
// Never log the API key or the full prompt.
import { createHash } from 'node:crypto';
import { cyp2d6Inhibitors, drugToGene } from '../../src/engine/data.js';
import { DRUG_NAMES_ES, NOT_SAME_AS_SAFE } from '../../src/engine/templates.js';
import type { SummaryLang } from '../../src/engine/templates.js';
import type { DrugAssessment } from '../../src/engine/types.js';

/** Per model attempt (R36). */
export const LLM_TIMEOUT_MS = 6000;
export const MAX_TOKENS = 600;
export const MAX_WORDS = 90;
export const CACHE_MAX = 500;
export const RATE_LIMIT = 20;
export const RATE_WINDOW_MS = 60_000;

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type LlmConfig = { baseUrl: string; apiKey: string; models: string[] };

/**
 * LLM settings from the server environment, or null when any are missing.
 * LLM_MODEL is a comma-separated fallback list, tried in order.
 */
export function llmConfig(): LlmConfig | null {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const models = (process.env.LLM_MODEL ?? '')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);
  if (!baseUrl || !apiKey || models.length === 0) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, models };
}

/**
 * The gateway (Manifest) answers some failures with HTTP 200 and the error as the content,
 * e.g. "[🦚 Manifest M102] anthropic subscription credentials could not be refreshed…".
 */
export function isGatewayError(content: string): boolean {
  return content.trimStart().startsWith('[🦚 Manifest') || content.includes('Manifest M1');
}

/** Remove Markdown emphasis and heading marks (`**`, `*`, `#`) and tidy the whitespace. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*+/g, '')
    .replace(/#+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

type ChatCompletion = {
  choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
};

/**
 * One POST to the OpenAI-compatible chat/completions endpoint for one model. Throws on a
 * non-2xx status, an empty or null answer, finish_reason "length", a gateway error passed
 * through as content, or the 6 s timeout. Returns the text with Markdown stripped.
 */
export async function callLlm(messages: ChatMessage[], model: string): Promise<string> {
  const config = llmConfig();
  if (!config) throw new Error('LLM not configured');

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The race guarantees the timeout even if a fetch implementation ignores the signal.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('LLM timeout'));
    }, LLM_TIMEOUT_MS);
  });

  try {
    const request = (async () => {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        // No `temperature`: Anthropic Claude 5.x via Manifest rejects it with HTTP 400.
        body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = (await res.json()) as ChatCompletion;
      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== 'string' || content.trim() === '') throw new Error('LLM empty response');
      if (choice?.finish_reason === 'length') throw new Error('LLM truncated (finish_reason length)');
      if (isGatewayError(content)) throw new Error('LLM gateway error');
      return stripMarkdown(content).replace(/^["“]|["”]$/g, '').trim();
    })();
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try each model in LLM_MODEL order. Move to the next one when the call fails or the text
 * fails validation. Returns null when every model failed (the caller uses the template).
 * Logs only the model position and the reason: never the key or the prompt.
 */
export async function summarizeWithFallback(
  assessment: DrugAssessment,
  lang: SummaryLang
): Promise<string | null> {
  const config = llmConfig();
  if (!config) return null;
  const messages = buildMessages(assessment, lang);
  for (const [i, model] of config.models.entries()) {
    const label = `model ${i + 1}/${config.models.length}`;
    try {
      const text = await callLlm(messages, model);
      const result = validate(text, assessment, lang);
      if (result.ok) return text;
      console.warn(`[summary] ${label}: AI text rejected (${result.reason})`);
    } catch (err) {
      console.warn(`[summary] ${label}: call failed (${err instanceof Error ? err.message : 'unknown'})`);
    }
  }
  return null;
}

// ---- Prompt ----

/** Only the DrugAssessment fields go to the model (build spec section 6). */
function promptInput(a: DrugAssessment) {
  return {
    drug: a.drug,
    triggeredBy: a.triggeredBy,
    gene: a.gene,
    genotype: a.genotype,
    genotypeActivityScore: a.genotypeActivityScore,
    genotypePhenotype: a.genotypePhenotype,
    inhibitor: a.inhibitor,
    adjustedActivityScore: a.adjustedActivityScore,
    adjustedPhenotype: a.adjustedPhenotype,
    phenoconverted: a.phenoconverted,
    confidence: a.confidence,
    alert: a.alert,
    recommendation: a.recommendation,
    strength: a.strength,
    ...(a.inhibitorNote ? { inhibitorNote: a.inhibitorNote } : {}),
    ...(a.labelNote ? { labelNote: a.labelNote } : {}),
  };
}

export function buildMessages(a: DrugAssessment, lang: SummaryLang): ChatMessage[] {
  const language = lang === 'es' ? 'Spanish' : 'English';
  const system = [
    `Rewrite this structured pharmacogenomics result for a patient, in ${language}.`,
    'Change no facts and add nothing. Do not give new advice.',
    'Use plain words: the liver has a "cleanup crew" for medicines; say how fast it clears this drug (Slow, Reduced, Normal, Fast).',
    'Name the drug. Keep the action: for alert RED, say the drug should be avoided or is not recommended; for YELLOW, describe the dosing plan and never say avoid; for GREY, say it was not assessed and a pharmacist should review it.',
    `Never call any drug or result safe. For GREEN, say there is no supported alert and that this is "${NOT_SAME_AS_SAFE[lang]}".`,
    'Do not use the words genotype, phenotype or metabolizer, and do not name the gene (for example CYP2D6 or CYP2C19); say "gene result" and use the cleanup-crew wording instead.',
    'Do not mention alert colors (for example "red alert").',
    'Mention no drug and no number that is not in the input.',
    'Keep every dose and time from the recommendation exactly.',
    'Plain text only, no Markdown.',
    `At most ${MAX_WORDS} words. Output only the summary text.`,
  ].join(' ');
  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(promptInput(a)) },
  ];
}

// ---- Validation (R33, R35) ----

/** Lowercase, strip accents, normalize curly apostrophes. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase();
}

function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(text);
}

/** Drugs outside RxGene's tables that a model might plausibly add (EN and ES names). */
const EXTRA_DRUGS: Array<[string, ...string[]]> = [
  ['morphine', 'morfina'],
  ['oxycodone', 'oxicodona'],
  ['hydrocodone', 'hidrocodona'],
  ['hydromorphone', 'hidromorfona'],
  ['fentanyl', 'fentanilo'],
  ['methadone', 'metadona'],
  ['tapentadol'],
  ['buprenorphine', 'buprenorfina'],
  ['oxymorphone', 'oximorfona'],
  ['prasugrel'],
  ['ticagrelor'],
  ['aspirin', 'aspirina'],
  ['warfarin', 'warfarina'],
  ['acetaminophen', 'paracetamol'],
  ['ibuprofen', 'ibuprofeno'],
  ['naproxen', 'naproxeno'],
  ['omeprazole', 'omeprazol'],
  ['esomeprazole', 'esomeprazol'],
  ['pantoprazole', 'pantoprazol'],
  ['lansoprazole', 'lansoprazol'],
  ['citalopram'],
  ['venlafaxine', 'venlafaxina'],
  ['amitriptyline', 'amitriptilina'],
  ['nortriptyline', 'nortriptilina'],
  ['methylphenidate', 'metilfenidato'],
  ['ondansetron'],
  ['tamoxifen', 'tamoxifeno'],
  ['metoprolol'],
];

/** Each entry: every name (EN + ES, normalized) for one drug. */
const DRUG_LEXICON: string[][] = (() => {
  const byCanonical = new Map<string, Set<string>>();
  const add = (canonical: string, ...names: string[]) => {
    const set = byCanonical.get(canonical) ?? new Set<string>();
    for (const n of [canonical, ...names]) set.add(normalize(n));
    byCanonical.set(canonical, set);
  };
  for (const drug of Object.keys(drugToGene)) add(drug);
  for (const set of [cyp2d6Inhibitors.strong, cyp2d6Inhibitors.moderate, cyp2d6Inhibitors.weak]) {
    for (const drug of set) add(drug);
  }
  for (const [en, es] of Object.entries(DRUG_NAMES_ES)) add(en, es);
  for (const [canonical, ...names] of EXTRA_DRUGS) add(canonical, ...names);
  return [...byCanonical.values()].map(s => [...s]);
})();

const RED_ACTION: Record<SummaryLang, RegExp> = {
  en: /avoid|not recommended|won't work|may not work/,
  es: /evitar|no se recomienda|puede no funcionar/,
};
/** Non-RED text must not escalate to an avoid meaning. */
const AVOID_WORD: Record<SummaryLang, RegExp> = { en: /\bavoid/, es: /\bevit/ };
const YELLOW_ACTION: Record<SummaryLang, RegExp> = { en: /\bdos(e|es|ing|age)\b/, es: /\bdosis\b/ };
const GREY_ACTION: Record<SummaryLang, RegExp> = {
  en: /not assessed|not computed|pharmacist|review/,
  es: /no fue evaluad|no evaluad|no se evalu|farmaceutic|revis/,
};
const SAFE_WORD = /\bsafe(ly|ty)?\b|\bsegur(o|a|os|as|idad)\b/;

/**
 * Brief 05: the patient text must not use genotype / phenotype / metabolizer or a gene name
 * (EN and ES forms; checked on normalized, lowercased text).
 */
const TECHNICAL_TERM =
  /\bgenotyp|\bphenotyp|\bmetaboli[sz]er|\bgenotip|\bfenotip|\bmetabolizador|\bcyp\s?2\s?[cd]\s?\d+/;

const NUMBER = /\d+(?:[.,]\d+)?/g;

function numbersIn(s: string): number[] {
  return (s.match(NUMBER) ?? []).map(n => Number(n.replace(',', '.')));
}

/** Standalone numbers only: skips digits inside names such as "CYP2D6". */
const STANDALONE_NUMBER = /(?<![A-Za-z\d.,])\d+(?:[.,]\d+)?/g;

function standaloneNumbersIn(s: string): number[] {
  return (s.match(STANDALONE_NUMBER) ?? []).map(n => Number(n.replace(',', '.')));
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * R35: the text names the drug, keeps the alert action, names no drug and no number that
 * is not in the input, and is 90 words or fewer. R33: no "safe"/"seguro" except in
 * "not the same as safe" / "no es lo mismo que seguro". Brief 05: no genotype / phenotype /
 * metabolizer and no gene name.
 */
export function validate(text: string, assessment: DrugAssessment, lang: SummaryLang): ValidationResult {
  const t = normalize(text);
  const input = normalize(JSON.stringify(assessment));

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { ok: false, reason: 'empty' };
  if (words.length > MAX_WORDS) return { ok: false, reason: 'too long' };

  // No technical terms (brief 05): genotype, phenotype, metabolizer, CYP2D6, CYP2C19.
  if (TECHNICAL_TERM.test(t)) return { ok: false, reason: 'technical term' };

  // Drug name (EN, or its ES name)
  const drug = normalize(assessment.drug);
  const drugNames = DRUG_LEXICON.find(names => names.includes(drug)) ?? [drug];
  if (!drugNames.some(n => hasWord(t, n))) return { ok: false, reason: 'drug name missing' };

  // Alert action
  switch (assessment.alert) {
    case 'RED':
      if (!RED_ACTION[lang].test(t)) return { ok: false, reason: 'RED action missing' };
      break;
    case 'YELLOW':
      if (AVOID_WORD[lang].test(t)) return { ok: false, reason: 'YELLOW says avoid' };
      if (!YELLOW_ACTION[lang].test(t)) return { ok: false, reason: 'YELLOW dosing missing' };
      break;
    case 'GREEN':
      if (AVOID_WORD[lang].test(t)) return { ok: false, reason: 'GREEN says avoid' };
      if (!t.includes(normalize(NOT_SAME_AS_SAFE[lang]))) return { ok: false, reason: 'GREEN disclaimer missing' };
      break;
    case 'GREY':
      if (AVOID_WORD[lang].test(t)) return { ok: false, reason: 'GREY says avoid' };
      if (!GREY_ACTION[lang].test(t)) return { ok: false, reason: 'GREY action missing' };
      break;
  }

  // "safe"/"seguro" only inside the fixed disclaimer (applied to every level, R33)
  const withoutDisclaimer = t.split(normalize(NOT_SAME_AS_SAFE.en)).join(' ').split(normalize(NOT_SAME_AS_SAFE.es)).join(' ');
  if (SAFE_WORD.test(withoutDisclaimer)) return { ok: false, reason: 'says safe' };

  // No drug outside the assessment
  for (const names of DRUG_LEXICON) {
    if (names.some(n => hasWord(t, n)) && !names.some(n => hasWord(input, n))) {
      return { ok: false, reason: 'new drug name' };
    }
  }

  // No number outside the assessment
  const allowed = new Set(numbersIn(JSON.stringify(assessment)));
  if (numbersIn(text).some(n => !allowed.has(n))) return { ok: false, reason: 'new number' };

  // Every dose/time number in the CPIC recommendation must survive (a text that drops "80 mg" fails)
  const inText = new Set(numbersIn(text));
  if (standaloneNumbersIn(assessment.recommendation).some(n => !inText.has(n))) {
    return { ok: false, reason: 'recommendation number missing' };
  }

  return { ok: true };
}

// ---- Cache ----

const cache = new Map<string, string>();

export function cacheKey(assessment: DrugAssessment, lang: SummaryLang): string {
  return createHash('sha256').update(JSON.stringify(assessment) + lang).digest('hex');
}

export function cacheGet(key: string): string | undefined {
  return cache.get(key);
}

/** Insert, evicting the oldest entry once the cache holds CACHE_MAX entries. */
export function cacheSet(key: string, text: string): void {
  if (cache.has(key)) cache.delete(key);
  while (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, text);
}

export function cacheSize(): number {
  return cache.size;
}

// ---- Rate limit (sliding window, per x-forwarded-for IP) ----

const hits = new Map<string, number[]>();
const MAX_TRACKED_IPS = 10_000;

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || 'unknown';
}

/** Records one request for `ip`. Returns true when it is over the limit (not recorded). */
export function isRateLimited(ip: string, now = Date.now()): boolean {
  const windowStart = now - RATE_WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter(ts => ts > windowStart);

  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);

  // Keep memory bounded: drop IPs with no requests in the window.
  if (hits.size > MAX_TRACKED_IPS) {
    for (const [key, list] of hits) {
      if (list.every(ts => ts <= windowStart)) hits.delete(key);
    }
  }
  return false;
}

/** Test helper: clear the cache and the rate-limit windows. */
export function resetLlmState(): void {
  cache.clear();
  hits.clear();
}
