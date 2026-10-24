import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import path from 'path'
import { devApi } from './vite-plugins/devApi.ts'

// Server-side only: the web/api handlers read these from process.env.
const SERVER_ENV_KEYS = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'] as const

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite doesn't put web/.env into process.env, so the dev-server API handlers never saw the
  // LLM settings. Copy ONLY these three keys. No `define` and no VITE_ prefix, so they never
  // reach the client bundle. Values already in process.env (shell/Vercel) win, because
  // loadEnv gives them priority. Skipped under Vitest so tests never pick up a real key.
  if (mode !== 'test' && !process.env.VITEST) {
    const env = loadEnv(mode, process.cwd(), '')
    for (const key of SERVER_ENV_KEYS) {
      if (env[key]) process.env[key] = env[key]
    }
  }

  return {
    plugins: [react(), tailwindcss(), devApi()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    test: {
      globals: true,
      environment: 'node',
      // Engine/UI tests (src/**), CDS Hooks handler tests (api/**), dev plugin tests (vite-plugins/**)
      include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts', 'vite-plugins/**/*.test.ts']
    }
  }
})
