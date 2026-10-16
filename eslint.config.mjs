import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const SERVER_ONLY = 'Server code: only src/server, src/proxy.ts and route handlers under src/app/api may import it.'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The engine holds prompts, API keys and private data: it must never reach a browser bundle.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/intelligence/**', 'src/server/**', 'src/proxy.ts', 'src/app/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/intelligence', '@/intelligence/*', '**/intelligence', '**/intelligence/*'], message: SERVER_ONLY },
            { group: ['@/server', '@/server/*', '**/server/*'], message: SERVER_ONLY },
          ],
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
])
