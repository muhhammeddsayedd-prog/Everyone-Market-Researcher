import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yViolations, settle, watchPage } from '../support/page-checks';
import { readStackState, signInCookies, storageStatePath } from '../support/sessions';

// Access boundaries are viewport-independent; run them once.
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop'));

test.describe('signed out', () => {
  test('protected pages redirect to sign-in and keep the destination', async ({ page }) => {
    const checks = watchPage(page);
    await page.goto('/competitors?tier=pilot');
    await expect(page).toHaveURL(/\/login\?next=%2Fcompetitors%3Ftier%3Dpilot$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText("it's no one.");
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.getByText('Invite-only. Ask Mohamed for access.')).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue('/competitors?tier=pilot');
    await expectNoSeriousA11yViolations(page);
    checks.expectClean();
  });

  test('every app route is gated, including data routes and planned pages', async ({ page }) => {
    for (const path of [
      '/',
      '/coverage',
      '/competitors/fixture-baseline/accounts',
      '/feed',
      '/admin/costs',
    ]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('responses are private and never cacheable', async ({ request }) => {
    for (const path of ['/login', '/competitors']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()['cache-control']).toContain('no-store');
      expect(response.headers()['cache-control']).toContain('private');
    }
  });

  test('Google sign-in starts PKCE OAuth with a validated callback', async ({ page }) => {
    const { apiUrl } = readStackState();
    let authorizeUrl = '';
    await page.route(`${apiUrl}/auth/v1/authorize**`, async (route) => {
      authorizeUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: 'text/plain', body: 'stubbed provider' });
    });
    await page.goto('/login?next=%2Fcompetitors%3Fview%3Dlist');
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect.poll(() => authorizeUrl).not.toBe('');
    const url = new URL(authorizeUrl);
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256');
    expect(url.searchParams.get('redirect_to')).toBe(
      'http://127.0.0.1:3100/auth/callback?next=%2Fcompetitors%3Fview%3Dlist',
    );
  });

  test('unsafe next values fall back to the home page', async ({ page }) => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', '/login']) {
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await expect(page.locator('input[name="next"]')).toHaveValue('/');
    }
  });

  test('a failed or forged callback returns to sign-in with an error', async ({ page }) => {
    await page.goto('/auth/callback?code=forged&next=https://evil.example');
    await expect(page).toHaveURL(/\/login\?error=oauth$/);
    await expect(page.getByRole('alert').filter({ hasText: 'Google sign-in' })).toHaveText(
      "Google sign-in didn't finish. Try again.",
    );
    await page.goto('/auth/callback?error=access_denied');
    await expect(page).toHaveURL(/\/login\?error=oauth$/);
  });
});

test.describe('signed in without membership', () => {
  test.use({ storageState: storageStatePath('outsider') });

  test('a Google account that was never invited sees no-access and no data', async ({ page }) => {
    const checks = watchPage(page);
    await page.goto('/competitors');
    await expect(page).toHaveURL('/no-access');
    await expect(
      page.getByRole('heading', { name: "Your account isn't on the invite list yet." }),
    ).toBeVisible();
    await expect(page.getByText('Signed in as outsider@e2e.test')).toBeVisible();
    await expect(page.getByText('Fixture Baseline Films')).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
    checks.expectClean();
  });
});

test.describe('disabled member', () => {
  test.use({ storageState: storageStatePath('disabled') });

  test('a disabled membership is refused on every route', async ({ page }) => {
    for (const path of ['/', '/competitors/fixture-baseline', '/coverage']) {
      await page.goto(path);
      await expect(page).toHaveURL('/no-access');
    }
  });
});

test.describe('roles', () => {
  test.describe('viewer', () => {
    test.use({ storageState: storageStatePath('member') });

    test('admin pages are hidden and return 404 on the server', async ({ page }) => {
      await page.goto('/competitors');
      await settle(page);
      const nav = page.getByRole('navigation', { name: 'Main' });
      await expect(nav.getByRole('list', { name: 'Admin' })).toHaveCount(0);
      await expect(nav.getByRole('link', { name: /Review/ })).toHaveCount(0);
      for (const path of ['/admin/costs', '/admin/users', '/review']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: "This page isn't on the radar." })).toBeVisible();
      }
    });

    test('a signed-in member visiting sign-in goes to the app', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('admin', () => {
    test.use({ storageState: storageStatePath('admin') });

    test('admin navigation shows planned pages with their dependency, not fake controls', async ({
      page,
    }) => {
      await page.goto('/admin/pipeline');
      await expect(page.getByRole('heading', { level: 1, name: 'Pipeline' })).toBeVisible();
      await expect(page.getByText("Pipeline isn't connected yet")).toBeVisible();
      await expect(page.getByText(/app\.pipeline_summary/)).toBeVisible();
      await expect(page.getByRole('button', { name: /re-scrape|run|collect|generate/i })).toHaveCount(0);
    });
  });
});

test.describe('sign out', () => {
  test('ends the session and protects the app again', async ({ browser }) => {
    // A fresh session: signing out revokes it, so the shared member session stays valid.
    const context = await browser.newContext();
    await context.addCookies(await signInCookies('member'));
    const page = await context.newPage();
    await page.goto('/competitors');
    await settle(page);
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/competitors');
    await expect(page).toHaveURL(/\/login\?next=%2Fcompetitors$/);
    await context.close();
  });
});
