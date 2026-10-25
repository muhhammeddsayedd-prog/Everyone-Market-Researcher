import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function tabTo(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  for (let count = 0; count < 18; count++) {
    if (await button.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(button).toBeFocused();
}

test('fixture directory is accessible, filterable and local-only', async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  const forbiddenRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.pathname.startsWith('/api/')) {
      forbiddenRequests.push(url.origin + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const response = await page.goto('/dev/competitors');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Competitors', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Fixture data notice' })).toContainText(
    'No live data',
  );
  await expect(page.getByRole('status')).toHaveText('12 of 12 fixture records');
  const results = page.getByRole('list', { name: 'Competitor results' });
  await expect(results.getByRole('listitem')).toHaveCount(12);
  await expect(results.getByRole('listitem').first()).toContainText('Everyone Films');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    ),
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('directory-grid.png'), fullPage: true });

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to competitors' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  const search = page.getByRole('searchbox', { name: 'Search by name' });
  await expect(search).toBeFocused();
  await page.keyboard.type('Wonderful');
  await expect(page.getByRole('status')).toHaveText('1 of 12 fixture records');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Market' })).toBeFocused();
  await tabTo(page, 'List view');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toHaveText('1 of 12 fixture records');

  await search.fill('No such production house');
  await expect(page.getByRole('heading', { name: 'No matching competitors' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByRole('combobox', { name: 'Market' }).selectOption('UAE');
  await page.getByRole('combobox', { name: 'Tier' }).selectOption('pilot');
  await page.getByRole('combobox', { name: 'Category' }).selectOption('production_services');
  await expect(page.getByRole('status')).toHaveText('2 of 12 fixture records');
  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await expect(page.getByRole('status')).toHaveText('12 of 12 fixture records');
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('directory-list.png'), fullPage: true });
  expect(forbiddenRequests).toEqual([]);
  expect(errors).toEqual([]);
});
