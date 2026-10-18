import { expect, test } from '@playwright/test';
import { settle, watchPage } from '../support/page-checks';
import { storageStatePath } from '../support/sessions';

test.use({ storageState: storageStatePath('member') });
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop'));

test('overview shows recorded facts, the stored logo and the Arabic name', async ({ page }) => {
  const checks = watchPage(page);
  await page.goto('/competitors/fixture-baseline');
  await settle(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Fixture Baseline Films' })).toBeVisible();
  const arabic = page.locator('[lang="ar"][dir="rtl"]', { hasText: 'أفلام التجربة' });
  await expect(arabic).toBeVisible();
  const logo = page.getByRole('img', { name: 'Fixture Baseline Films' }).first();
  await expect(logo).toHaveJSProperty('complete', true);
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(logo).toHaveAttribute(
    'src',
    /\/storage\/v1\/object\/public\/media\/logos\/fixture-baseline\.svg$/,
  );
  await expect(page.getByText('Stored copy of the public logo')).toBeVisible();
  await expect(page.getByText('Egypt, Saudi Arabia, UAE')).toBeVisible();
  await expect(page.getByText('Not available yet')).toBeVisible();
  checks.expectClean();
});

test('companies without a stored logo show initials, never a broken image', async ({ page }) => {
  await page.goto('/competitors/fixture-quote-studio');
  await settle(page);
  const tile = page.getByTestId('logo-initials').first();
  await expect(tile).toHaveText('FQ');
  await expect(tile).toHaveAttribute('aria-label', 'Fixture "Quote" Studio');
  await expect(page.getByText('Initials (no stored logo)')).toBeVisible();
});

test('sources keep configuration, resolution, eligibility and collection evidence separate', async ({
  page,
}) => {
  await page.goto('/competitors/fixture-exclusion-studio/accounts');
  await settle(page);
  const youtube = page.getByRole('table', { name: 'YouTube sources' });
  await expect(youtube.getByText('Invalid')).toBeVisible();
  await expect(youtube.getByText('Failed', { exact: true })).toBeVisible();
  await expect(youtube.getByText('YouTube channel not found')).toBeVisible();
  await expect(youtube.getByText('Reviewed exclusion (D-27): skipped')).toBeVisible();
  await expect(youtube.getByText('Not collected yet')).toBeVisible();

  const website = page.getByRole('table', { name: 'Website sources' });
  await expect(website.getByText('Active')).toBeVisible();
  await expect(website.getByText('Website unreachable (timeout)')).toBeVisible();

  await page.goto('/competitors/fixture-baseline/accounts');
  await settle(page);
  const instagram = page.getByRole('table', { name: 'Instagram sources' });
  await expect(instagram.getByText('Instagram posts', { exact: true })).toBeVisible();
  await expect(instagram.getByText('Instagram stories', { exact: true })).toBeVisible();
  await expect(instagram.getByText(/Collected /)).toBeVisible();
  await expect(page.getByText(/share the same public profile/)).toBeVisible();
});

test('unsafe recorded URLs are never rendered as links', async ({ page }) => {
  await page.goto('/competitors/fixture-paused-house');
  await settle(page);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByText('Paused', { exact: true }).first()).toBeVisible();
  await page.goto('/competitors/fixture-paused-house/accounts');
  await settle(page);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByText('fixturepaused (link unavailable)').first()).toBeVisible();
});

test('in-house capabilities are grouped from recorded codes', async ({ page }) => {
  await page.goto('/competitors/fixture-baseline/capabilities');
  await settle(page);
  const pre = page.locator('div', { has: page.getByRole('heading', { name: 'Pre-production' }) }).last();
  await expect(pre.getByText('Directors roster')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Post' })).toBeVisible();
  await expect(page.getByText('Not stated on own site')).toHaveCount(0);
});

test('tabs without collected evidence say what they wait for', async ({ page }) => {
  await page.goto('/competitors/fixture-baseline/team');
  await settle(page);
  await expect(page.getByText('Not available yet')).toBeVisible();
  await expect(page.getByText(/LinkedIn employee snapshots/)).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Company sections' });
  await expect(tabs.getByRole('link', { name: /Team/ })).toHaveAttribute('aria-current', 'page');
  const unknown = await page.goto('/competitors/fixture-baseline/unknown-tab');
  expect(unknown?.status()).toBe(404);
  const missing = await page.goto('/competitors/no-such-company');
  expect(missing?.status()).toBe(404);
});

test('coverage is counted from records with fixtures excluded', async ({ page }) => {
  const checks = watchPage(page);
  await page.goto('/coverage');
  await settle(page);
  const companies = page.getByRole('region', { name: 'Companies' });
  await expect(companies.getByText('59', { exact: true }).first()).toBeVisible();
  const pilot = page.getByRole('table', { name: 'Pilot and baseline sources' });
  const youtube = pilot.getByRole('row', { name: /YouTube videos/ });
  await expect(youtube).toContainText('1 reviewed exclusion (D-27)');
  await expect(page.getByText(/Smoke-test fixtures are excluded/)).toBeVisible();
  checks.expectClean();
});
