import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// This suite runs the production build with NO Supabase configuration (as CI's e2e job does).
// The app must fail closed: no sign-in, no data, no app pages — only the unavailable notice.

test('every route fails closed with 503 when configuration is missing', async ({ request }) => {
  for (const path of [
    '/',
    '/competitors',
    '/competitors/any-company/accounts',
    '/coverage',
    '/login',
    '/auth/callback?code=x',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(503);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
    const body = await response.text();
    expect(body).toContain("Market Radar isn't available here.");
    expect(body).not.toMatch(/sb_secret|service_role|api_agent|n8n_writer/);
  }
});

test('the unavailable notice is accessible, branded and fits every viewport', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => failedRequests.push(request.url()));

  const response = await page.goto('/unavailable');
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle('Unavailable · everyone. Market Radar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(
    page.getByRole('heading', { level: 1, name: "Market Radar isn't available here." }),
  ).toBeVisible();

  const wordmark = page.getByRole('img', { name: 'everyone.' });
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveJSProperty('naturalWidth', 519);
  await expect(wordmark).toHaveCSS('filter', 'brightness(0) invert(1)');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(failedRequests).toEqual([]);
  expect(errors).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath('unavailable.png'), fullPage: true });
});

test('the client bundle carries no server secrets or machine-role names', async ({ page }) => {
  const scripts: string[] = [];
  page.on('response', async (response) => {
    if (response.url().includes('/_next/static/') && response.url().endsWith('.js'))
      scripts.push(await response.text());
  });
  await page.goto('/unavailable');
  await page.waitForLoadState('networkidle');
  expect(scripts.length).toBeGreaterThan(0);
  for (const source of scripts)
    expect(source).not.toMatch(
      /sb_secret_|SUPABASE_SECRET_KEY|API_AGENT_DATABASE_URL|INTERNAL_WEBHOOK_SECRET/,
    );
});
