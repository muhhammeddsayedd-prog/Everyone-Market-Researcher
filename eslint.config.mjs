import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/next-env.d.ts',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '.agents/**',
    '.m00-clean-*/**',
  ]),
  ...tseslint.configs.recommended,
  ...nextVitals.map((config) => ({ ...config, files: ['apps/web/**/*.{ts,tsx,js,mjs}'] })),
  {
    settings: { next: { rootDir: 'apps/web/' } },
    rules: { 'no-console': ['warn', { allow: ['error'] }] },
  },
]);
