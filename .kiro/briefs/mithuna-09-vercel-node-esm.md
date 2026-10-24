Model: claude-haiku-4.5. Run this AFTER briefs 07 and 08 (they touch the same files).

Production bug, from Vercel runtime logs on https://rxgene.vercel.app: every CDS Hooks call returns 500 FUNCTION_INVOCATION_FAILED with
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/web/src/engine/index' imported from /var/task/web/api/cds-services/rxgene-order-select.js`.
Vercel runs web/api/* as plain Node ES modules (package.json has "type": "module"), and Node ESM doesn't resolve extensionless imports or JSON without import attributes. Vite resolves both, which is why local dev and the tests pass.

Fix every file that web/api/** imports, directly or indirectly (web/api/**, web/api/_lib/**, web/src/engine/**, and any other src file they reach):
1. Add an explicit `.js` extension to every relative import: './types' -> './types.js', '../../src/engine/index' -> '../../src/engine/index.js'. TypeScript's bundler resolution maps .js to the .ts source, and Vite resolves it too.
2. Add import attributes to every JSON import: `import x from '../data/inhibitors.json' with { type: 'json' };`
3. None of these server-reachable files may use the '@/' alias. Replace any with relative paths plus the .js extension. Files only the browser loads may keep '@/'.
4. Create web/.vercelignore containing `api/**/*.test.ts` so test files are no longer deployed as functions. Today /api/summary.test is a live (crashing) endpoint.
5. Run `npx tsc -b`, `npm test` and `npm run build`. All must pass. (Production verification happens on the Vercel preview after push: Claude POSTs a P01 order-select request and checks for a critical card. Don't try to emulate Vercel locally.)

Don't run git. List the files you changed.
