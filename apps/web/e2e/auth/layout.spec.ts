import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  saveScreenshot,
  settle,
  watchPage,
} from '../support/page-checks';
import { storageStatePath } from '../support/sessions';

test.use({ storageState: storageStatePath('member') });

const PAGES = [
  { name: 'competitors-grid', path: '/competitors' },
  { name: 'competitors-list', path: '/competitors?view=list' },
  { name: 'competitors-filtered', path: '/competitors?tier=pilot&market=EG' },
  { name: 'profile-overview', path: '/competitors/fixture-baseline' },
  { name: 'profile-sources', path: '/competitors/fixture-exclusion-studio/accounts' },
  { name: 'profile-capabilities', path: '/competitors/fixture-baseline/capabilities' },
  { name: 'coverage', path: '/coverage' },
  { name: 'planned-pulse', path: '/' },
];

for (const { name, path } of PAGES) {
  test(`${name}: responsive, accessible, no runtime errors`, async ({ page }, testInfo) => {
    const checks = watchPage(page);
    await page.goto(path);
    await settle(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousA11yViolations(page);
    await saveScreenshot(page, testInfo, name);
    checks.expectClean();
  });
}

test('signed-out sign-in page: responsive and accessible', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: testInfo.project.use.viewport ?? undefined,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);
  await saveScreenshot(page, testInfo, 'login');
  await context.close();
});

test('navigation adapts: sidebar on desktop, rail on tablet, bottom bar and menu sheet on phones', async ({
  page,
}, testInfo) => {
  await page.goto('/competitors');
  await settle(page);
  const sidebar = page.locator('aside');
  const bottom = page.getByRole('navigation', { name: 'Primary' });
  if (testInfo.project.name === 'mobile') {
    await expect(sidebar).toBeHidden();
    await expect(bottom).toBeVisible();
    const menu = bottom.getByRole('button', { name: 'Menu' });
    await menu.click();
    const dialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Coverage' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(menu).toBeFocused();
    await page.getByRole('button', { name: /Filters/ }).click();
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await expect(sidebar).toBeVisible();
    await expect(bottom).toBeHidden();
    const width = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBe(testInfo.project.name === 'tablet' ? 72 : 248);
  }
});

test('keyboard: skip link first, visible focus, search dialog traps and restores focus', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Keyboard path is checked on the hardware-keyboard layouts');
  await page.goto('/competitors');
  await settle(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();

  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Search is coming in M11' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.keyboard.press('/');
  await expect(page.getByLabel('Search by name or code')).toBeFocused();
  const ring = await page
    .getByLabel('Search by name or code')
    .evaluate((element) => getComputedStyle(element).boxShadow);
  expect(ring).not.toBe('none');
});

test('reduced motion removes transitions, shimmer and hover scale', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/competitors');
  await settle(page);
  const duration = await page
    .locator('.card-media')
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration).toBe('0s');
  const card = page.locator('article[data-company-code]').first();
  await card.hover();
  const transform = await page
    .locator('.card-media')
    .first()
    .evaluate((element) => getComputedStyle(element).transform);
  expect(transform).toBe('none');
});
