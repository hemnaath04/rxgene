import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import path from 'path'
import { devApi } from './vite-plugins/devApi.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    // Engine tests (src/**) plus the CDS Hooks handler tests (api/**)
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts']
  }
})
