import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Authenticated journey suite against the isolated local Supabase stack
 * (`node apps/web/e2e/support/stack.mjs up` first). The app is built with only the local URL
 * and publishable key; no secret, machine role or hosted project is involved.
 */
const state = JSON.parse(readFileSync(new URL('./e2e/.stack/state.json', import.meta.url), 'utf8')) as {
  apiUrl: string;
  publishableKey: string;
};

const env = {
  NEXT_PUBLIC_SUPABASE_URL: state.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: state.publishableKey,
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
};

export default defineConfig({
  testDir: './e2e/auth',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/auth' }]],
  globalSetup: './e2e/support/global-setup.ts',
  expect: { timeout: 10_000 },
  outputDir: 'test-results/auth',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', viewport: { width: 320, height: 700 } },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/login',
    env,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
