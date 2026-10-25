import { defineConfig } from '@playwright/test';
import productionConfig from './playwright.config';

// This route intentionally does not exist in a production build. Run its
// fixture-only browser checks against a fresh, local Next development server.
export default defineConfig({
  ...productionConfig,
  testMatch: '**/competitor-directory.dev.spec.ts',
  testIgnore: [],
  workers: 1,
  retries: 0,
  outputDir: 'test-results/directory-dev',
  use: { ...productionConfig.use, baseURL: 'http://127.0.0.1:3025' },
  webServer: {
    command: 'pnpm exec next dev --hostname 127.0.0.1 --port 3025',
    url: 'http://127.0.0.1:3025',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
