import { expect, test, type Page } from '@playwright/test';
import { settle, watchPage } from '../support/page-checks';
import { storageStatePath } from '../support/sessions';

test.use({ storageState: storageStatePath('member') });
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop'));

// Every non-fixture company in apps/web/e2e/fixtures/web-e2e.seed.sql. C999 is a smoke fixture.
const EXPECTED_CODES = [
  'C000',
  'C102',
  'C901',
  'C902',
  'C903',
  'C904',
  'C905',
  ...Array.from({ length: 52 }, (_, index) => `C${911 + index}`),
].sort();

type Row = { code: string; name: string };

async function visibleRows(page: Page): Promise<Row[]> {
  return page.locator('article[data-company-code]').evaluateAll((cards) =>
    cards.map((card) => ({
      code: card.getAttribute('data-company-code') ?? '',
      name: card.querySelector('h2')?.textContent?.trim() ?? '',
    })),
  );
}

/** Walks every page with Next, returning the rows in display order. */
async function walkAllPages(page: Page, start: string): Promise<Row[][]> {
  await page.goto(start);
  await settle(page);
  const pages: Row[][] = [];
  for (let guard = 0; guard < 10; guard += 1) {
    pages.push(await visibleRows(page));
    const next = page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: 'Next' });
    if ((await next.count()) === 0) break;
    await next.click();
    await expect(page).toHaveURL(new RegExp(`page=${pages.length + 1}`));
    await settle(page);
  }
  return pages;
}

const byCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

test('keyset pagination by name returns every company once, baseline pinned first', async ({ page }) => {
  const checks = watchPage(page);
  const pages = await walkAllPages(page, '/competitors');
  expect(pages).toHaveLength(3);
  const rows = pages.flat();
  expect(rows.map((row) => row.code).toSorted()).toEqual(EXPECTED_CODES);
  expect(new Set(rows.map((row) => row.code)).size).toBe(rows.length);
  expect(pages[0]![0]!.code).toBe('C000');
  expect(rows.filter((row) => row.code === 'C000')).toHaveLength(1);
  const names = rows.slice(1).map((row) => row.name);
  expect(names).toEqual(names.toSorted(byCodeUnits));
  await expect(page.getByText('Page 3 of 3')).toBeVisible();
  checks.expectClean();
});

test('Previous returns to exactly the earlier pages', async ({ page }) => {
  const forward = await walkAllPages(page, '/competitors?sort=-name');
  const prev = page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: 'Previous' });
  await prev.click();
  await expect(page).toHaveURL(/page=2/);
  await settle(page);
  expect(await visibleRows(page)).toEqual(forward[1]);
  await prev.click();
  await expect(page).toHaveURL(/\/competitors\?sort=-name$/);
  await settle(page);
  expect(await visibleRows(page)).toEqual(forward[0]);
});

for (const sort of ['-name', 'code', 'updated']) {
  test(`sort ${sort}: no missing or duplicated rows across pages (ties broken by id)`, async ({ page }) => {
    const rows = (await walkAllPages(page, `/competitors?sort=${sort}`)).flat();
    expect(rows.map((row) => row.code).toSorted()).toEqual(EXPECTED_CODES);
    if (sort === 'code') {
      const codes = rows.slice(1).map((row) => row.code);
      expect(codes).toEqual(codes.toSorted());
    }
    if (sort === '-name') {
      const names = rows.slice(1).map((row) => row.name);
      expect(names).toEqual(names.toSorted(byCodeUnits).reverse());
    }
  });
}

test('the journey: filter, open a company, inspect sources, open the original, return to the list', async ({
  page,
  context,
}) => {
  const checks = watchPage(page);
  // External sites are never contacted from tests; the stub proves the link target.
  await context.route('https://www.linkedin.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }),
  );

  await page.goto('/competitors');
  await settle(page);
  await expect(page.getByText('59 companies', { exact: true })).toBeVisible();

  await page.getByLabel('Tier').selectOption('pilot');
  await expect(page).toHaveURL(/tier=pilot/);
  await settle(page);
  const pilotRows = await visibleRows(page);
  expect(pilotRows.length).toBeGreaterThan(0);
  for (const card of await page.locator('article[data-company-code]').all())
    await expect(card.getByText('Pilot', { exact: true })).toBeVisible();

  await page.getByLabel('Search by name or code').fill('comma');
  await page.getByLabel('Search by name or code').press('Enter');
  await expect(page).toHaveURL(/q=comma/);
  await settle(page);
  await expect(page.getByText('1 of 59 companies match')).toBeVisible();
  const listUrl = page.url();

  await page.getByRole('link', { name: 'Fixture, Comma (Parens) Films' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Fixture, Comma (Parens) Films' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Company sections' })
    .getByRole('link', { name: 'Sources' })
    .click();
  await expect(page).toHaveURL(/\/competitors\/fixture-comma-parens\/accounts\?from=/);
  await settle(page);
  await expect(page.getByRole('heading', { name: 'LinkedIn' })).toBeVisible();
  await expect(page.getByText(/share the same public profile/)).toBeVisible();

  const source = page
    .getByRole('table')
    .getByRole('link', { name: /fixture-comma/ })
    .first();
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  await expect(source).toHaveAttribute('target', '_blank');
  const [popup] = await Promise.all([page.waitForEvent('popup'), source.click()]);
  await expect(popup).toHaveURL('https://www.linkedin.com/company/fixture-comma/');
  await popup.close();

  await page.getByRole('link', { name: 'Back to competitors' }).click();
  await expect(page).toHaveURL(listUrl);
  await settle(page);
  await expect(page.getByLabel('Tier')).toHaveValue('pilot');
  await expect(page.getByLabel('Search by name or code')).toHaveValue('comma');
  await expect(page.getByRole('link', { name: 'Fixture, Comma (Parens) Films' })).toBeVisible();

  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/fixture-comma-parens$|fixture-comma-parens\?from=/);
  checks.expectClean();
});

test('market switcher filters by market and is kept in the URL', async ({ page }) => {
  await page.goto('/competitors');
  await settle(page);
  await page.getByRole('navigation', { name: 'Market' }).getByRole('link', { name: 'KSA' }).click();
  await expect(page).toHaveURL(/market=KSA/);
  await settle(page);
  const cards = await page.locator('article[data-company-code]').all();
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) await expect(card.getByText('Saudi Arabia')).toBeAttached();
  await expect(page.getByRole('link', { name: /Saudi Arabia/ })).toBeVisible();
});

test('search tolerates quotes and punctuation; smoke fixtures never appear', async ({ page }) => {
  await page.goto('/competitors?q=%22Quote%22');
  await settle(page);
  expect((await visibleRows(page)).map((row) => row.code)).toEqual(['C902']);

  await page.goto('/competitors?q=Test+House');
  await settle(page);
  await expect(page.getByText('No companies match these filters.')).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/competitors$/);

  const response = await page.goto('/competitors/test-house');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: "This page isn't on the radar." })).toBeVisible();
});

test('list view keeps its mode through paging and shows a semantic table', async ({ page }) => {
  await page.goto('/competitors');
  await settle(page);
  await page.getByRole('navigation', { name: 'View' }).getByRole('link', { name: 'List' }).click();
  await expect(page).toHaveURL(/view=list/);
  const table = page.getByRole('table', { name: 'Competitors' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Name' })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(25);
  await page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: 'Next' }).click();
  await expect(page).toHaveURL(/view=list.*page=2|page=2.*view=list/);
  await expect(page.getByRole('table', { name: 'Competitors' })).toBeVisible();
});

test('tampered or stale cursors restart at the first page', async ({ page }) => {
  await page.goto('/competitors?cursor=not-a-real-cursor&page=7');
  await settle(page);
  expect((await visibleRows(page))[0]!.code).toBe('C000');
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
});
