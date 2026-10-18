import { describe, expect, it } from 'vitest';
import { safeNextPath } from './auth/next-path';
import { authOrigin } from './auth/origin';
import { parsePublicEnv } from './env';
import { initialsFor, logoSrc } from './view/logo';
import { safeExternalUrl } from './view/safe-url';

describe('safeExternalUrl', () => {
  it('accepts plain http(s) source links', () => {
    expect(safeExternalUrl('https://www.instagram.com/goodpeople/')).toEqual({
      href: 'https://www.instagram.com/goodpeople/',
      host: 'instagram.com',
    });
    expect(safeExternalUrl(' http://example.com/work ')?.host).toBe('example.com');
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'https://localhost/admin',
    'https://exa mple.com',
    '//example.com',
    '',
    null,
  ])('rejects %s', (raw) => {
    expect(safeExternalUrl(raw)).toBeNull();
  });
});

describe('logoSrc', () => {
  const base = 'https://ref.supabase.co';
  it('builds public Storage URLs only for stored logo paths', () => {
    expect(logoSrc(`${base}/`, 'logos/good-people.svg')).toBe(
      `${base}/storage/v1/object/public/media/logos/good-people.svg`,
    );
    expect(logoSrc(base, 'logos/c-01.webp')).toContain('/media/logos/c-01.webp');
  });

  it.each([
    null,
    '',
    'https://cdn.example.com/logo.png',
    '../secrets.svg',
    'logos/../x.svg',
    'logos/x.svg?download',
    'logos/x.html',
    'thumbnails/x.webp',
  ])('falls back to initials for %s', (path) => {
    expect(logoSrc(base, path)).toBeNull();
  });

  it('derives initials from names', () => {
    expect(initialsFor('Good People Films')).toBe('GP');
    expect(initialsFor('electriclime°')).toBe('EL');
    expect(initialsFor('Fixture "Quote" Studio')).toBe('FQ');
    expect(initialsFor('أفلام التجربة')).toBe('أا');
    expect(initialsFor('***')).toBe('—');
  });
});

describe('safeNextPath', () => {
  it('keeps same-origin relative paths with their query', () => {
    expect(safeNextPath('/competitors?tier=pilot')).toBe('/competitors?tier=pilot');
    expect(safeNextPath('/competitors/good-people/accounts')).toBe('/competitors/good-people/accounts');
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    '/login',
    '/auth/callback?code=x',
    '/no-access',
    '/%0d%0aSet-Cookie:x',
    '/\nfoo',
    '',
    null,
  ])('rejects %s', (raw) => {
    expect(safeNextPath(raw)).toBe('/');
  });
});

describe('parsePublicEnv (fails closed)', () => {
  const valid = {
    supabaseUrl: 'https://zmotjsbzhzjvpelxvxlf.supabase.co/',
    supabasePublishableKey: 'sb_publishable_abcdefghijklmnop',
    siteUrl: 'http://localhost:3000',
  };

  it('accepts complete public configuration', () => {
    const result = parsePublicEnv(valid);
    expect(result.ok && result.env.supabaseUrl).toBe('https://zmotjsbzhzjvpelxvxlf.supabase.co');
  });

  it('reports missing values by variable name only', () => {
    expect(parsePublicEnv({ ...valid, supabaseUrl: undefined })).toEqual({
      ok: false,
      missing: ['NEXT_PUBLIC_SUPABASE_URL'],
    });
  });

  it('refuses secret keys and legacy service JWTs in the browser-visible key slot', () => {
    for (const key of [
      'sb_secret_abcdefghijklmnop',
      'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x',
    ])
      expect(parsePublicEnv({ ...valid, supabasePublishableKey: key }).ok).toBe(false);
  });

  it('rejects non-http URLs', () => {
    expect(parsePublicEnv({ ...valid, siteUrl: 'javascript:alert(1)' }).ok).toBe(false);
  });
});

describe('authOrigin (OAuth return host)', () => {
  const site = 'https://everyone-market-researcher-git-m09-80aab7-team.vercel.app';
  it('returns to the Vercel host the user started from', () => {
    expect(authOrigin(site, 'everyone-market-researcher-aithmf50y-team.vercel.app', 'https')).toBe(
      'https://everyone-market-researcher-aithmf50y-team.vercel.app',
    );
    expect(authOrigin(site, '127.0.0.1:3100', 'http')).toBe('http://127.0.0.1:3100');
    expect(authOrigin(site, 'localhost:3000', 'http')).toBe('http://localhost:3000');
  });

  it('falls back to the configured site for untrusted or malformed hosts', () => {
    for (const host of ['evil.example', 'evil.example/vercel.app', 'a b', '', null])
      expect(authOrigin(site, host, 'https')).toBe(site);
  });

  it('never downgrades a remote host to http', () => {
    expect(authOrigin(site, 'x.vercel.app', 'http')).toBe('https://x.vercel.app');
  });
});
