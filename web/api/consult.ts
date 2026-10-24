// POST /api/consult: pharmacist consult agent endpoint (R45–R54).
// Body: { patient: { id, name, cyp2d6?, cyp2c19?, meds: string[] }, addedDrug?: string }
// Returns: { note, source: 'ai' | 'template', reason?, trace, model?, ms }
import { runConsultAgent, buildAgentDeps, templateConsultNote, type AgentResult } from './_lib/agent.js';
import { clientIp, isRateLimited } from './_lib/llm.js';
import { buildFullAssessments, type ToolContext } from './_lib/agentTools.js';
import type { Patient } from '../src/engine/types.js';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isPatient(v: unknown): v is Patient {
  if (!isObject(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.id.trim() !== '' &&
    Array.isArray(v.meds) &&
    v.meds.every(m => typeof m === 'string')
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

  if (!isObject(body) || !isPatient(body.patient)) {
    return badRequest('Body must be { patient: { id, name, cyp2d6?, cyp2c19?, meds }, addedDrug? }');
  }

  const patient: Patient = body.patient;
  const addedDrug = typeof body.addedDrug === 'string' ? body.addedDrug : undefined;

  // Build the full medication list (R45).
  const allMeds = addedDrug ? [...patient.meds, addedDrug] : patient.meds;

  // Check rate limit.
  if (isRateLimited(clientIp(request))) {
    // Return template immediately. Use buildFullAssessments for R55 compliance.
    const assessments = buildFullAssessments(patient, allMeds);
    const note = templateConsultNote(assessments);
    return Response.json({
      note,
      source: 'template',
      reason: 'rate limited',
      trace: [],
      ms: 0
    } satisfies AgentResult);
  }

  // Build context.
  const ctx: ToolContext = {
    patient,
    allMeds,
    addedDrug,
    assessments: new Map()
  };

  // Run the agent, or fall back to template if the LLM is unavailable.
  const deps = buildAgentDeps();
  let result: AgentResult;
  if (!deps) {
    // LLM unavailable. Use buildFullAssessments for R55 compliance.
    const assessments = buildFullAssessments(patient, allMeds);
    const note = templateConsultNote(assessments);
    result = { note, source: 'template', reason: 'LLM unavailable', trace: [], ms: 0 };
  } else {
    result = await runConsultAgent(ctx, deps);
  }

  return Response.json(result);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
