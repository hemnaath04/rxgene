import { describe, it, expect } from 'vitest';
import { matchApiRoute } from './devApi.ts';

describe('devApi matchApiRoute', () => {
  it('handles the real API routes, applying the /cds-services rewrite', () => {
    expect(matchApiRoute('/api/summary')).toBe('/api/summary');
    expect(matchApiRoute('/api/consult')).toBe('/api/consult');
    expect(matchApiRoute('/api/cds-services')).toBe('/api/cds-services');
    expect(matchApiRoute('/api/cds-services/rxgene-order-select')).toBe('/api/cds-services/rxgene-order-select');
    expect(matchApiRoute('/cds-services')).toBe('/api/cds-services');
    expect(matchApiRoute('/cds-services/rxgene-order-select')).toBe('/api/cds-services/rxgene-order-select');
    expect(matchApiRoute('/cds-services/rxgene-order-select/')).toBe('/api/cds-services/rxgene-order-select');
  });

  it('passes ES module requests for /api/_lib to Vite (the blank-page bug)', () => {
    expect(matchApiRoute('/api/_lib/fhir.ts')).toBeNull();
    expect(matchApiRoute('/api/_lib/fhir.ts?t=1729786000000')).toBeNull();
    expect(matchApiRoute('/api/_lib/llm.ts')).toBeNull();
    expect(matchApiRoute('/api/_lib')).toBeNull();
  });

  it('passes any path with a file extension to Vite', () => {
    for (const ext of ['ts', 'tsx', 'js', 'mjs', 'json']) {
      expect(matchApiRoute(`/api/cds-services.${ext}`)).toBeNull();
      expect(matchApiRoute(`/api/cds-services/rxgene-order-select.${ext}`)).toBeNull();
      expect(matchApiRoute(`/cds-services/x.${ext}`)).toBeNull();
    }
  });

  it("passes requests with Vite's module query params to Vite", () => {
    expect(matchApiRoute('/api/cds-services?import')).toBeNull();
    expect(matchApiRoute('/api/cds-services/rxgene-order-select?t=123')).toBeNull();
    expect(matchApiRoute('/api/summary?v=abc123')).toBeNull();
  });

  it('ignores everything else', () => {
    for (const url of [
      '/',
      '/?patient=sarah&add=codeine',
      '/src/main.tsx',
      '/api',
      '/api/',
      '/api/other',
      '/api/summary/extra',
      '/api/cds-services/a/b',
      '/api/cds-services/_lib',
      '/api/cds-services.test',
      '/cds-services-x',
      '/api/%5Flib/fhir'
    ]) {
      expect(matchApiRoute(url), url).toBeNull();
    }
  });
});
