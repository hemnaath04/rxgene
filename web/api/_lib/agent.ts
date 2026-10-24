// Pharmacist consult agent (R45–R56).
// The agent calls deterministic tools and drafts a consult note. The rule engine decides
// everything; the agent only gathers tool results and writes them up (R34, R46).
import { TOOLS, runTool, type ToolContext, buildFullAssessments } from './agentTools.js';
import { llmConfig, isGatewayError } from './llm.js';
import type { DrugAssessment } from '../../src/engine/types.js';
import { KNOWN_DRUGS } from './fhir.js';
import {
  INDETERMINATE_TEXT,
  INSUFFICIENT_DATA_TEXT,
  GREEN_ALERT_TEXT,
  ATOMOXETINE_DISCREPANCY_FLAG
} from '../../src/engine/fixedTexts.js';

const MAX_ROUNDS = 8;
const MAX_TOTAL_MS = 25_000;
const PER_CALL_TIMEOUT_MS = 8_000;

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type TraceEntry = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  ms: number;
};

export type NoteSentence = {
  text: string;
  cites: string[];
};

export type NoteSection = {
  heading: string;
  sentences: NoteSentence[];
};

export type ConsultNote = {
  sections: NoteSection[];
};

export type AgentResult = {
  note: ConsultNote;
  source: 'ai' | 'template';
  reason?: string;
  trace: TraceEntry[];
  model?: string;
  ms: number;
};

type ChatCompletion = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
};

// ---- Agent dependencies (injected for testing) ----

export type AgentDeps = {
  fetch: typeof fetch;
  now: () => number;
  models: string[];
  baseUrl: string;
  apiKey: string;
};

function buildSystemPrompt(): string {
  return [
    "You are drafting a pharmacogenomics consult note for a pharmacist to review.",
    "Call check_drug for every medication on the list and for the added drug if there is one.",
    "Every sentence that states a recommendation, alert level, phenotype, activity score, inhibitor class or any other clinical fact must cite the tool_call ids it came from.",
    "State only what the tools returned. Keep each drug's action exactly (RED: avoid; YELLOW: the dose/titration plan; GREY: not assessed, pharmacist review; GREEN: no supported alert, not the same as safe).",
    "Never call anything safe.",
    "Do not add drugs, doses or numbers that are not in tool results.",
    "Keep every dose and time from the recommendation text.",
    'Output only JSON in this format: { "sections": [ { "heading": string, "sentences": [ { "text": string, "cites": [tool_call_id, ...] } ] } ] }.',
    'Suggested headings: "Pharmacogenomic summary", "Medication-specific findings", "Drug–drug–gene interactions", "Recommendations for prescriber".'
  ].join(' ');
}

function buildUserMessage(patientName: string, medCount: number): string {
  return `Draft a consult note for ${patientName}. There are ${medCount} medications to review.`;
}

async function callLlmWithTools(
  messages: ChatMessage[],
  model: string,
  deps: AgentDeps,
  timeoutMs: number
): Promise<ChatCompletion> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('LLM timeout'));
    }, timeoutMs);
  });

  try {
    const request = (async () => {
      const res = await deps.fetch(`${deps.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deps.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          max_tokens: 1200
        }),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = (await res.json()) as ChatCompletion;
      return data;
    })();
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function makeTraceSummary(tool: string, args: Record<string, unknown>, result: unknown): string {
  if (tool === 'get_patient') return 'get_patient() → patient info';
  if (tool === 'list_inhibitors') {
    const inhibitors = result as Array<{ drug: string; fdaClass: string }>;
    if (inhibitors.length === 0) return 'list_inhibitors() → none';
    return `list_inhibitors() → ${inhibitors.map(i => `${i.drug} (${i.fdaClass})`).join(', ')}`;
  }
  if (tool === 'check_drug' && typeof args.drug === 'string') {
    const assessment = result as { alert: string; recommendation: string };
    const actionMatch = assessment.recommendation.match(/^[^.]{0,50}/);
    const action = actionMatch ? actionMatch[0] : assessment.recommendation.slice(0, 50);
    return `check_drug(${args.drug}) → ${assessment.alert} · ${action}`;
  }
  if (tool === 'get_evidence' && typeof args.drug === 'string') {
    const evidence = result as { guideline: string };
    return `get_evidence(${args.drug}) → ${evidence.guideline}`;
  }
  return `${tool}(${JSON.stringify(args)})`;
}

export async function runConsultAgent(ctx: ToolContext, deps: AgentDeps): Promise<AgentResult> {
  const startMs = deps.now();
  const trace: TraceEntry[] = [];
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserMessage(ctx.patient.id, ctx.allMeds.length) }
  ];

  let modelIndex = 0;
  let model = deps.models[modelIndex];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const elapsed = deps.now() - startMs;
    if (elapsed > MAX_TOTAL_MS) {
      return templateFallback(ctx, trace, 'max time exceeded', deps.now() - startMs);
    }

    let completion: ChatCompletion;
    try {
      completion = await callLlmWithTools(messages, model, deps, PER_CALL_TIMEOUT_MS);
    } catch (err) {
      console.warn(`[agent] model ${modelIndex + 1}: ${err instanceof Error ? err.message : 'unknown'}`);
      return templateFallback(ctx, trace, 'model call failed', deps.now() - startMs);
    }

    const choice = completion.choices?.[0];
    const assistantMessage = choice?.message;
    if (!assistantMessage?.role || assistantMessage.role !== 'assistant') {
      return templateFallback(ctx, trace, 'invalid response', deps.now() - startMs);
    }

    // Check for gateway errors in the content.
    const content = assistantMessage.content ?? '';
    if (isGatewayError(content)) {
      console.warn(`[agent] model ${modelIndex + 1}: gateway error`);
      modelIndex++;
      if (modelIndex >= deps.models.length) {
        return templateFallback(ctx, trace, 'all models failed (gateway error)', deps.now() - startMs);
      }
      model = deps.models[modelIndex];
      // Reset messages and try again with the next model.
      messages.length = 2;
      continue;
    }

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      // Final answer: parse the JSON.
      try {
        const note = JSON.parse(content) as ConsultNote;
        if (!isValidNoteStructure(note)) {
          return templateFallback(ctx, trace, 'invalid JSON structure', deps.now() - startMs);
        }
        // Validate the note.
        const assessments = [...ctx.assessments.values()];
        const validation = validateNote(note, trace, assessments);
        if (!validation.ok) {
          console.warn(`[agent] validation failed: ${validation.reason}`);
          return templateFallback(ctx, trace, `validation: ${validation.reason}`, deps.now() - startMs);
        }
        return { note, source: 'ai', trace, model, ms: deps.now() - startMs };
      } catch {
        return templateFallback(ctx, trace, 'JSON parse failed', deps.now() - startMs);
      }
    }

    // Tool calls: execute them.
    messages.push({
      role: 'assistant',
      content: content || '',
      tool_calls: toolCalls.map(tc => ({
        id: tc.id ?? '',
        type: 'function',
        function: { name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' }
      }))
    });

    for (const tc of toolCalls) {
      const callStart = deps.now();
      const toolName = tc.function?.name ?? '';
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments ?? '{}') as Record<string, unknown>;
      } catch {
        args = {};
      }

      const result = runTool(toolName, args, ctx);
      const callMs = deps.now() - callStart;

      if (result.ok) {
        trace.push({
          id: tc.id ?? '',
          tool: toolName,
          args,
          summary: makeTraceSummary(toolName, args, result.result),
          ms: callMs
        });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id ?? '',
          content: JSON.stringify(result.result)
        });
      } else {
        trace.push({
          id: tc.id ?? '',
          tool: toolName,
          args,
          summary: `${toolName}(${JSON.stringify(args)}) → error: ${result.error}`,
          ms: callMs
        });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id ?? '',
          content: JSON.stringify({ error: result.error })
        });
      }
    }
  }

  return templateFallback(ctx, trace, 'max rounds exceeded', deps.now() - startMs);
}

function isValidNoteStructure(note: unknown): note is ConsultNote {
  if (typeof note !== 'object' || note === null || !('sections' in note)) return false;
  const sections = (note as { sections: unknown }).sections;
  if (!Array.isArray(sections)) return false;
  for (const sec of sections) {
    if (typeof sec !== 'object' || sec === null) return false;
    if (typeof (sec as { heading?: unknown }).heading !== 'string') return false;
    const sentences = (sec as { sentences?: unknown }).sentences;
    if (!Array.isArray(sentences)) return false;
    for (const sent of sentences) {
      if (typeof sent !== 'object' || sent === null) return false;
      if (typeof (sent as { text?: unknown }).text !== 'string') return false;
      const cites = (sent as { cites?: unknown }).cites;
      if (!Array.isArray(cites) || !cites.every(c => typeof c === 'string')) return false;
    }
  }
  return true;
}

// ---- Validation (R47–R50, R55–R56) ----

type ValidationResult = { ok: true } | { ok: false; reason: string };

const CLINICAL_TERMS = /\b(red|yellow|avoid|adjust|titrat|dose|dosing|phenotype|activity score|inhibitor|metabolizer|recommendation)\b/i;

/** Numbers that are NOT part of gene/allele/requirement IDs. */
const STANDALONE_NUMBER = /(?<![A-Za-z*R])\d+(?:\.\d+)?(?![A-Za-z*])/g;

function extractNumbers(text: string): Set<number> {
  const matches = text.match(STANDALONE_NUMBER) ?? [];
  return new Set(matches.map(m => parseFloat(m)));
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function containsSubstring(text: string, substr: string): boolean {
  return normalize(text).includes(normalize(substr));
}

export function validateNote(note: ConsultNote, trace: TraceEntry[], assessments: DrugAssessment[]): ValidationResult {
  const traceIds = new Set(trace.map(t => t.id));
  const noteText = JSON.stringify(note);
  const normalizedNote = normalize(noteText);

  // For R50 number check: extract only prose text (headings + sentence text), not cite IDs.
  const proseText = note.sections
    .map(sec => [sec.heading, ...sec.sentences.map(s => s.text)].join(' '))
    .join(' ');

  // Collect all tool results as text.
  const toolResultsText = JSON.stringify(trace.map(t => {
    const entry = trace.find(e => e.id === t.id);
    return entry ? entry.summary : '';
  }));

  // R47: every sentence with a clinical fact must cite a valid tool call.
  for (const section of note.sections) {
    for (const sentence of section.sentences) {
      if (CLINICAL_TERMS.test(sentence.text)) {
        if (sentence.cites.length === 0) {
          return { ok: false, reason: 'R47: clinical sentence without citation' };
        }
        for (const cite of sentence.cites) {
          if (!traceIds.has(cite)) {
            return { ok: false, reason: `R47: invalid citation ${cite}` };
          }
        }
      }
    }
  }

  // R48: every RED or YELLOW drug must be mentioned, with its action.
  const redYellowDrugs = assessments.filter(a => a.alert === 'RED' || a.alert === 'YELLOW');
  for (const a of redYellowDrugs) {
    const drugMentioned = containsSubstring(noteText, a.drug);
    if (!drugMentioned) {
      return { ok: false, reason: `R48: ${a.alert} drug ${a.drug} not mentioned` };
    }
    if (a.alert === 'RED' && !normalize(noteText).includes('avoid')) {
      return { ok: false, reason: `R48: RED drug ${a.drug} missing avoid action` };
    }
    if (a.alert === 'YELLOW') {
      const hasYellowAction = /\b(adjust|titrat|dose|dosing)\b/i.test(noteText);
      if (!hasYellowAction) {
        return { ok: false, reason: `R48: YELLOW drug ${a.drug} missing dose/titration action` };
      }
    }
  }

  // R49: no drug outside the list/addedDrug/recommendation texts.
  const allowedDrugs = new Set(assessments.map(a => a.drug.toLowerCase()));
  // Also allow drugs from check_drug tool calls (includes inhibitor-only drugs).
  for (const t of trace) {
    if (t.tool === 'check_drug' && typeof t.args.drug === 'string') {
      allowedDrugs.add(t.args.drug.toLowerCase());
    }
  }
  for (const a of assessments) {
    // Extract drugs from recommendation text.
    for (const knownDrug of KNOWN_DRUGS) {
      if (containsSubstring(a.recommendation, knownDrug)) {
        allowedDrugs.add(knownDrug);
      }
    }
  }
  for (const knownDrug of KNOWN_DRUGS) {
    if (containsSubstring(noteText, knownDrug) && !allowedDrugs.has(knownDrug)) {
      return { ok: false, reason: `R49: note names ${knownDrug} not on list or in recommendations` };
    }
  }

  // R50: no number outside tool results (scan prose only, not cite IDs).
  const noteNumbers = extractNumbers(proseText);
  const allowedNumbers = extractNumbers(toolResultsText);
  for (const num of noteNumbers) {
    if (!allowedNumbers.has(num)) {
      return { ok: false, reason: `R50: note contains number ${num} not in tool results` };
    }
  }

  // R33: no "safe"/"seguro" except in the fixed disclaimer.
  const withoutDisclaimer = normalizedNote
    .split('not the same as safe')
    .join(' ')
    .split('no es lo mismo que seguro')
    .join(' ');
  if (/\bsafe(ly|ty)?\b|\bsegur(o|a|os|as|idad)\b/.test(withoutDisclaimer)) {
    return { ok: false, reason: 'R33: note says safe' };
  }

  // R55: every medication must have a check_drug call and be mentioned.
  const checkedDrugs = new Set<string>();
  for (const t of trace) {
    if (t.tool === 'check_drug' && typeof t.args.drug === 'string') {
      checkedDrugs.add(t.args.drug.toLowerCase());
    }
  }
  for (const a of assessments) {
    if (!checkedDrugs.has(a.drug.toLowerCase())) {
      return { ok: false, reason: `R55: ${a.drug} has no check_drug call` };
    }
    if (!containsSubstring(noteText, a.drug)) {
      return { ok: false, reason: `R55: ${a.drug} not mentioned in note` };
    }

    // GREY: must contain the fixed text verbatim.
    if (a.alert === 'GREY') {
      if (containsSubstring(a.recommendation, 'indeterminate')) {
        if (!containsSubstring(noteText, INDETERMINATE_TEXT)) {
          return { ok: false, reason: `R55: GREY drug ${a.drug} missing Indeterminate text` };
        }
      } else if (containsSubstring(a.recommendation, 'insufficient data')) {
        if (!containsSubstring(noteText, INSUFFICIENT_DATA_TEXT)) {
          return { ok: false, reason: `R55: GREY drug ${a.drug} missing Insufficient data text` };
        }
      } else if (containsSubstring(a.recommendation, 'not assessed')) {
        // R18 "Not assessed" for atomoxetine + moderate inhibitor.
        if (!containsSubstring(noteText, 'not assessed')) {
          return { ok: false, reason: `R55: GREY drug ${a.drug} missing Not assessed text` };
        }
      }
    }

    // GREEN: must use the exact fixed text.
    if (a.alert === 'GREEN') {
      if (!containsSubstring(noteText, GREEN_ALERT_TEXT)) {
        return { ok: false, reason: `R55: GREEN drug ${a.drug} missing fixed GREEN text` };
      }
    }
  }

  // R56: qualifiers must be kept.
  for (const a of assessments) {
    // Both phenotypes side by side (R19).
    if (a.genotypePhenotype && a.adjustedPhenotype && a.genotypePhenotype !== a.adjustedPhenotype) {
      if (!containsSubstring(noteText, a.genotypePhenotype) || !containsSubstring(noteText, a.adjustedPhenotype)) {
        return { ok: false, reason: `R56: ${a.drug} missing both phenotypes` };
      }
    }

    // Reduced confidence flag (R20).
    if (a.confidence === 'reduced' && !containsSubstring(noteText, 'reduced confidence')) {
      return { ok: false, reason: `R56: ${a.drug} missing reduced confidence flag` };
    }

    // Inhibitor note (R21).
    if (a.inhibitorNote && !containsSubstring(noteText, a.inhibitorNote)) {
      return { ok: false, reason: `R56: ${a.drug} missing inhibitor note` };
    }

    // FDA/CPIC "Different guidance contexts" (R17).
    if (a.discrepancyFlag && !containsSubstring(noteText, ATOMOXETINE_DISCREPANCY_FLAG)) {
      return { ok: false, reason: `R56: ${a.drug} missing discrepancy flag` };
    }

    // Omeprazole–clopidogrel label note (R28).
    if (a.labelNote && !containsSubstring(noteText, a.labelNote)) {
      return { ok: false, reason: `R56: ${a.drug} missing label note` };
    }

    // Population (R26, R27).
    if (a.source.population && !containsSubstring(noteText, a.source.population)) {
      return { ok: false, reason: `R56: ${a.drug} missing population` };
    }
  }

  return { ok: true };
}

// ---- Template fallback (R51) ----

function templateFallback(ctx: ToolContext, trace: TraceEntry[], reason: string, ms: number): AgentResult {
  // R55: every medication must be in the note. Use buildFullAssessments to ensure complete coverage,
  // not ctx.assessments which may be incomplete if the LLM failed mid-run.
  const assessments = buildFullAssessments(ctx.patient, ctx.allMeds);
  const note = templateConsultNote(assessments);
  return { note, source: 'template', reason, trace, ms };
}

export function templateConsultNote(assessments: DrugAssessment[]): ConsultNote {
  const sections: NoteSection[] = [];

  // Summary section.
  const summaryText = `Reviewed ${assessments.length} medication${assessments.length === 1 ? '' : 's'} against patient pharmacogenomic results.`;
  sections.push({
    heading: 'Pharmacogenomic summary',
    sentences: [{ text: summaryText, cites: [] }]
  });

  // Medication-specific findings.
  const findings: NoteSentence[] = [];
  for (const a of assessments) {
    let text = `${a.drug}: ${a.alert} alert. `;
    if (a.alert === 'RED' || a.alert === 'YELLOW') {
      text += `Recommendation: ${a.recommendation}`;
    } else if (a.alert === 'GREEN') {
      text += GREEN_ALERT_TEXT;
    } else {
      text += a.recommendation;
    }
    findings.push({ text, cites: [] });
  }
  if (findings.length > 0) {
    sections.push({ heading: 'Medication-specific findings', sentences: findings });
  }

  return { sections };
}

// ---- Public helpers for endpoint ----

export function buildAgentDeps(): AgentDeps | null {
  const config = llmConfig();
  if (!config) return null;
  return {
    fetch,
    now: () => Date.now(),
    models: config.models,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey
  };
}
