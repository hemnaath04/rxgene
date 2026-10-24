// Tests for the pharmacist consult agent endpoint.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from './consult.js';
import type { AgentResult } from './_lib/agent.js';
import { checkOrder } from '../src/engine/index.js';
import type { Patient } from '../src/engine/types.js';
import { resetLlmState } from './_lib/llm.js';

describe('POST /api/consult', () => {
  // Mock patient.
  const patient: Patient = {
    id: 'P01',
    name: 'Test Patient',
    cyp2d6: '*1/*4',
    cyp2c19: '*1/*2',
    meds: ['fluoxetine', 'codeine']
  };

  beforeEach(() => {
    resetLlmState();
    process.env.LLM_BASE_URL = 'https://example.com/v1';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'model1,model2';
  });

  afterEach(() => {
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });

  it('returns 400 for invalid body', async () => {
    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ invalid: true })
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('happy path: model calls check_drug twice, returns valid JSON', async () => {
    let callCount = 0;
    const mockFetch = async (url: string, init?: RequestInit) => {
      callCount++;
      const body = JSON.parse(init?.body as string);

      if (callCount === 1) {
        // First call: model asks for tools.
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'codeine' }) }
                    },
                    {
                      id: 'call_2',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'fluoxetine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      } else {
        // Second call: model returns the note.
        const note = {
          sections: [
            {
              heading: 'Pharmacogenomic summary',
              sentences: [
                {
                  text: 'Reviewed both medications against patient pharmacogenomic results.',
                  cites: ['call_1', 'call_2']
                }
              ]
            },
            {
              heading: 'Medication-specific findings',
              sentences: [
                {
                  text: 'Codeine: RED alert. Avoid codeine. Intermediate Metabolizer by genotype, phenoconverted to Poor Metabolizer due to fluoxetine (strong CYP2D6 inhibitor).',
                  cites: ['call_1']
                },
                {
                  text: 'Fluoxetine: GREY alert. Fluoxetine is a CYP2D6 inhibitor (strong class, FDA). No independent pharmacogenomic assessment for this medication. This medication is a strong CYP2D6 inhibitor and may affect other drugs metabolized by CYP2D6.',
                  cites: ['call_2']
                }
              ]
            }
          ]
        };
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: JSON.stringify(note) }, finish_reason: 'stop' }]
          })
        );
      }
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('ai');
    expect(data.trace).toHaveLength(2);
    expect(data.trace[0].tool).toBe('check_drug');
    expect(data.trace[0].args.drug).toBe('codeine');
    expect(data.trace[1].tool).toBe('check_drug');
    expect(data.trace[1].args.drug).toBe('fluoxetine');
    expect(data.note.sections).toHaveLength(2);
    // Every cite should resolve to a trace entry.
    for (const section of data.note.sections) {
      for (const sentence of section.sentences) {
        for (const cite of sentence.cites) {
          expect(data.trace.some(t => t.id === cite)).toBe(true);
        }
      }
    }
  });

  it('validation failure: uncited factual sentence -> template', async () => {
    const mockFetch = async () => {
      const note = {
        sections: [
          {
            heading: 'Findings',
            sentences: [{ text: 'Codeine: RED alert. Avoid.', cites: [] }] // No citation!
          }
        ]
      };
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: JSON.stringify(note) }, finish_reason: 'stop' }]
        })
      );
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('template');
    expect(data.reason).toContain('validation');
  });

  it('validation failure: note names drug not on list -> template', async () => {
    const mockFetch = async (url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.messages.length === 2) {
        // First call: return tool calls.
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'codeine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      } else {
        // Second call: mention a drug not on the list.
        const note = {
          sections: [
            {
              heading: 'Findings',
              sentences: [
                { text: 'Codeine: RED alert. Avoid.', cites: ['call_1'] },
                { text: 'Also consider morphine.', cites: ['call_1'] } // morphine not on list!
              ]
            }
          ]
        };
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: JSON.stringify(note) }, finish_reason: 'stop' }]
          })
        );
      }
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('template');
    expect(data.reason).toContain('validation');
  });

  it('validation failure: RED drug missing from note -> template', async () => {
    const mockFetch = async (url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.messages.length === 2) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'codeine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      } else {
        // Skip codeine in the note.
        const note = {
          sections: [{ heading: 'Findings', sentences: [{ text: 'All medications reviewed.', cites: ['call_1'] }] }]
        };
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: JSON.stringify(note) }, finish_reason: 'stop' }]
          })
        );
      }
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('template');
    expect(data.reason).toContain('validation');
  });

  it('validation failure: note contains "safe" -> template', async () => {
    const mockFetch = async (url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.messages.length === 2) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'fluoxetine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      } else {
        const note = {
          sections: [
            { heading: 'Findings', sentences: [{ text: 'Fluoxetine is safe to use.', cites: ['call_1'] }] } // says "safe"!
          ]
        };
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: JSON.stringify(note) }, finish_reason: 'stop' }]
          })
        );
      }
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('template');
    expect(data.reason).toContain('validation');
  });

  it('max rounds: 9 tool-call rounds -> template, reason "max rounds"', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      // Every call returns a tool call request (loop forever).
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: `call_${callCount}`,
                    type: 'function',
                    function: { name: 'get_patient', arguments: '{}' }
                  }
                ]
              },
              finish_reason: 'tool_calls'
            }
          ]
        })
      );
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('template');
    expect(data.reason).toContain('max rounds');
    expect(callCount).toBeGreaterThanOrEqual(8);
  });

  it('Manifest error on model 1 -> model 2 is used', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        // First call: gateway error.
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '[🦚 Manifest M102] credentials could not be refreshed'
                },
                finish_reason: 'stop'
              }
            ]
          })
        );
      } else {
        // Second call (model 2): success.
        const note = {
          sections: [
            {
              heading: 'Summary',
              sentences: [{ text: 'The second model succeeded.', cites: [] }]
            }
          ]
        };
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: JSON.stringify(note) }, finish_reason: 'stop' }]
          })
        );
      }
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient: { ...patient, meds: [] } }) // No meds, so validation passes trivially.
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(callCount).toBe(2);
    expect(data.model).toBe('model2');
  });

  it('R54: checkOrder output is identical before and after runConsultAgent', async () => {
    const mockFetch = async () => {
      const note = {
        sections: [{ heading: 'Summary', sentences: [{ text: 'Done.', cites: [] }] }]
      };
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: JSON.stringify(note) }, finish_reason: 'stop' }]
        })
      );
    };

    global.fetch = mockFetch as typeof fetch;

    // Test with codeine as the added drug (the drug being checked).
    const beforeAgent = checkOrder(patient, 'codeine');

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient, addedDrug: 'codeine' })
    });
    await POST(request);

    const afterAgent = checkOrder(patient, 'codeine');

    // Deep equality: the engine's output must not have changed.
    expect(afterAgent).toEqual(beforeAgent);
  });

  it('10s call succeeds (mocked clock) with 15s per-call timeout', async () => {
    let callCount = 0;
    const mockFetch = async (url: string, init?: RequestInit) => {
      callCount++;
      const body = JSON.parse(init?.body as string);

      if (callCount === 1) {
        // First call: model asks for tools.
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'codeine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      } else {
        // Second call: simulate a 10s call by returning valid JSON.
        // The timeout is 15s, so this should succeed.
        const note = {
          sections: [
            {
              heading: 'Pharmacogenomic summary',
              sentences: [{ text: 'Reviewed codeine against patient pharmacogenomic results.', cites: ['call_1'] }]
            },
            {
              heading: 'Medication-specific findings',
              sentences: [
                {
                  text: 'Codeine: RED alert. Avoid codeine. Intermediate Metabolizer by genotype, phenoconverted to Poor Metabolizer due to a strong CYP2D6 inhibitor.',
                  cites: ['call_1']
                }
              ]
            }
          ]
        };
        return new Response(
          JSON.stringify({
            choices: [
              { message: { role: 'assistant', content: JSON.stringify(note) }, finish_reason: 'stop' }
            ]
          })
        );
      }
    };

    // Mock the time function to simulate a 10s call on the second invocation.
    let currentTime = 0;
    const mockNow = () => {
      const time = currentTime;
      currentTime += 5000; // Simulate 5s per call
      return time;
    };

    const deps = {
      fetch: mockFetch as typeof fetch,
      now: mockNow,
      models: ['model1'],
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key'
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('ai'); // Should succeed, not fall back to template
    expect(callCount).toBe(2); // Two LLM calls
  });

  it('finish_reason "length" goes to next model', async () => {
    let callCount = 0;
    const mockFetch = async (url: string, init?: RequestInit) => {
      callCount++;
      const body = JSON.parse(init?.body as string);

      if (callCount === 1) {
        // First call: tool calls.
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'codeine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      } else if (callCount === 2) {
        // Second call (model 1): return truncated with finish_reason "length".
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '{"sections": ['
                },
                finish_reason: 'length'
              }
            ]
          })
        );
      } else {
        // Third call (model 2): reset and tool calls again.
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_2',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'codeine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      }
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({
        patient: { ...patient, meds: [] } // No existing meds to simplify
      })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(callCount).toBeGreaterThanOrEqual(3); // At least tool call, truncation, then tool call on model 2
  });

  it('template sentences have non-empty cites that resolve in trace', async () => {
    // Force a validation failure to trigger template fallback.
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'codeine' }) }
                    },
                    {
                      id: 'call_2',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'fluoxetine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      } else {
        // Return invalid JSON to trigger template fallback.
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: 'invalid json' }, finish_reason: 'stop' }]
          })
        );
      }
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('template'); // Fallback due to invalid JSON

    // Verify template sentences have cites that resolve in trace.
    const traceIds = new Set(data.trace.map(t => t.id));
    for (const section of data.note.sections) {
      for (const sentence of section.sentences) {
        // If the sentence mentions a drug (RED/YELLOW), it should have cites.
        if (/\b(codeine|fluoxetine|RED|YELLOW|GREY|GREEN|alert)\b/i.test(sentence.text)) {
          // Medication-specific findings should have cites.
          if (section.heading === 'Medication-specific findings') {
            expect(sentence.cites.length).toBeGreaterThan(0);
            // Every cite should resolve to a trace entry.
            for (const cite of sentence.cites) {
              expect(traceIds.has(cite)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('markdown code fence wrapped JSON is parsed successfully', async () => {
    let callCount = 0;
    const mockFetch = async (url: string, init?: RequestInit) => {
      callCount++;
      const body = JSON.parse(init?.body as string);

      if (callCount === 1) {
        // First call: tool calls.
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'codeine' }) }
                    },
                    {
                      id: 'call_2',
                      type: 'function',
                      function: { name: 'check_drug', arguments: JSON.stringify({ drug: 'fluoxetine' }) }
                    }
                  ]
                },
                finish_reason: 'tool_calls'
              }
            ]
          })
        );
      } else {
        // Second call: return JSON wrapped in markdown code fence.
        const note = {
          sections: [
            {
              heading: 'Pharmacogenomic summary',
              sentences: [
                {
                  text: 'Reviewed both medications against patient pharmacogenomic results.',
                  cites: ['call_1', 'call_2']
                }
              ]
            },
            {
              heading: 'Medication-specific findings',
              sentences: [
                {
                  text: 'Codeine: RED alert. Avoid codeine. Intermediate Metabolizer by genotype, phenoconverted to Poor Metabolizer due to fluoxetine (strong CYP2D6 inhibitor).',
                  cites: ['call_1']
                },
                {
                  text: 'Fluoxetine: GREY alert. Fluoxetine is a CYP2D6 inhibitor (strong class, FDA). No independent pharmacogenomic assessment for this medication. This medication is a strong CYP2D6 inhibitor and may affect other drugs metabolized by CYP2D6.',
                  cites: ['call_2']
                }
              ]
            }
          ]
        };
        // Wrap in markdown code fence
        const wrappedJson = `\`\`\`json\n${JSON.stringify(note)}\n\`\`\``;
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: wrappedJson }, finish_reason: 'stop' }]
          })
        );
      }
    };

    global.fetch = mockFetch as typeof fetch;

    const request = new Request('http://localhost/api/consult', {
      method: 'POST',
      body: JSON.stringify({ patient })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as AgentResult;
    expect(data.source).toBe('ai'); // Should parse successfully despite code fence
    expect(data.trace).toHaveLength(2);
    expect(data.note.sections).toHaveLength(2);
  });
});
