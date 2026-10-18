import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCREENSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '__screenshots__');

/** Collects runtime errors and failed same-origin requests for the whole test. */
export function watchPage(page: Page) {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    // Navigations aborted by a following navigation are not failures.
    if (!failure.includes('ERR_ABORTED')) failed.push(`${request.url()} ${failure}`);
  });
  return {
    expectClean() {
      expect(errors, 'console/page errors').toEqual([]);
      expect(failed, 'failed requests').toEqual([]);
    },
  };
}

/** Waits until streamed server content replaced the loading skeleton. */
export async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"][aria-label^="Loading"]')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
}

export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(' ')).join(', ')}`);
  expect(serious).toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'page must not scroll horizontally',
  ).toBe(true);
}

/** Responsive evidence (M09 AC8): apps/web/e2e/__screenshots__/<name>-<project>.png */
export async function saveScreenshot(page: Page, testInfo: TestInfo, name: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: join(SCREENSHOT_DIR, `${name}-${testInfo.project.name}.png`),
    caret: 'initial',
    animations: 'disabled',
  });
}
