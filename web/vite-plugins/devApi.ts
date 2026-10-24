// Dev-only Vite plugin: serves the web/api/* Web-standard handlers on the Vite dev server,
// so `npm run dev` gives the UI and the API on one port (architecture spec section 1).
// Mirrors web/vercel.json: the /cds-services rewrites and the CORS headers.
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

// Same paths as the "headers" sources in vercel.json
const CORS_PATH = /^\/(api\/)?cds-services(\/.*)?$/;

/** vercel.json rewrites: /cds-services and /cds-services/:path* -> /api/cds-services/... */
function rewrite(pathname: string): string {
  return /^\/cds-services(\/|$)/.test(pathname) ? `/api${pathname}` : pathname;
}

/**
 * Map /api/<route> to web/api/<route>.ts (or <route>/index.ts), the way Vercel does.
 * Segments starting with '_' (e.g. _lib) and test files are never routes.
 */
function resolveHandlerFile(apiDir: string, pathname: string): string | null {
  const route = pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const segments = route === '' ? [] : route.split('/');
  if (segments.some(s => s === '' || s === '.' || s === '..' || s.startsWith('_') || s.includes('\\'))) {
    return null;
  }
  const base = path.resolve(apiDir, ...segments);
  if (base !== apiDir && !base.startsWith(apiDir + path.sep)) return null;

  for (const file of [`${base}.ts`, path.join(base, 'index.ts')]) {
    if (!/\.test\.ts$/.test(file) && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function readBody(req: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

async function toWebRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) headers.append(key, v);
  }
  const method = (req.method ?? 'GET').toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
  return new Request(url, { method, headers, body });
}

async function sendWebResponse(res: ServerResponse, response: Response, extra: Record<string, string>) {
  res.statusCode = response.status;
  for (const [key, value] of Object.entries(extra)) res.setHeader(key, value);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(new Uint8Array(await response.arrayBuffer()));
}

function sendJson(res: ServerResponse, status: number, body: unknown, extra: Record<string, string>) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(extra)) res.setHeader(key, value);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function devApi(): Plugin {
  return {
    name: 'rxgene-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const apiDir = path.resolve(server.config.root, 'api');

      // Registered directly (not in a returned hook), so it runs before Vite's SPA fallback.
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const pathname = rewrite(url.pathname);
        if (pathname !== '/api' && !pathname.startsWith('/api/')) return next();

        const cors = CORS_PATH.test(url.pathname) ? CORS_HEADERS : {};
        const method = (req.method ?? 'GET').toUpperCase();

        void (async () => {
          const file = resolveHandlerFile(apiDir, pathname);
          if (!file) return sendJson(res, 404, { error: `No API route for ${pathname}` }, cors);

          const mod = (await server.ssrLoadModule(file)) as Record<string, unknown>;
          const handler = mod[method];
          if (typeof handler !== 'function') {
            if (method === 'OPTIONS') {
              res.statusCode = 204;
              for (const [key, value] of Object.entries(cors)) res.setHeader(key, value);
              return res.end();
            }
            const allow = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].filter(
              m => typeof mod[m] === 'function'
            );
            return sendJson(res, 405, { error: `Method ${method} not allowed` }, { ...cors, Allow: allow.join(',') });
          }

          const response = (await handler(await toWebRequest(req, url))) as Response;
          await sendWebResponse(res, response, cors);
        })().catch((err: unknown) => {
          if (err instanceof Error) server.ssrFixStacktrace(err);
          server.config.logger.error(`[rxgene-dev-api] ${pathname}: ${String((err as Error)?.stack ?? err)}`);
          if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' }, cors);
          else res.end();
        });
      });
    }
  };
}
