import { describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import type { ResolutionAccount, AccountPatch } from './database';
import { checkAccounts, probeProviders, resolveAccounts, type ProviderProbe } from './resolve-accounts';

const noDatabase = undefined as unknown as Sql;
const passed: ProviderProbe = { vimeo: { status: 'passed' }, youtube: { status: 'passed' } };
function account(index: number, patch: Partial<ResolutionAccount> = {}): ResolutionAccount {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    competitor_id: '00000000-0000-4000-8000-000000000999',
    company_code: `C${String(index).padStart(3, '0')}`,
    priority_tier: 'next_wave',
    platform: 'vimeo',
    handle: `user${index}`,
    handle_norm: `user${index}`,
    url: `https://vimeo.com/user${index}`,
    status: 'paused',
    resolve_status: 'pending',
    external_id: null,
    uploads_playlist_id: null,
    backfill_cursor: null,
    backfill_status: 'pending',
    items_count: 0,
    last_error: null,
    last_run_id: null,
    last_success_at: null,
    last_external_id: null,
    last_item_published_at: null,
    locked_until: null,
    row_version: '1',
    updated_at_text: '2026-10-18T00:00:00Z',
    has_collection: false,
    consecutive_failures: 0,
    next_due_at_text: '2026-10-18T00:00:00Z',
    last_error_at_text: null,
    ...patch,
  };
}
const resolved = async () => ({ resolve_status: 'resolved' as const, external_id: '123', last_error: null });

describe('account resolution orchestration with explicit provider/DB-write adapters', () => {
  it('reports missing providers independently without calls or writes', async () => {
    const resolveVimeo = vi.fn(resolved),
      resolveYouTube = vi.fn(resolved);
    expect(await probeProviders([], {}, { resolvers: { resolveVimeo, resolveYouTube } })).toEqual({
      vimeo: { status: 'missing', code: 'vimeo_missing_token' },
      youtube: { status: 'missing', code: 'yt_missing_key' },
    });
    expect(resolveVimeo).not.toHaveBeenCalled();
    expect(resolveYouTube).not.toHaveBeenCalled();
  });
  it('blocks Vimeo authentication without stamping its accounts, while YouTube continues', async () => {
    const rows = [
      account(1),
      account(2, {
        platform: 'youtube',
        handle: '@aflamproductions',
        handle_norm: '@aflamproductions',
        url: 'https://www.youtube.com/@aflamproductions',
      }),
    ];
    const resolveVimeo = vi.fn(async () => ({ resolve_status: 'failed' as const, last_error: 'vimeo_auth' }));
    const resolveYouTube = vi.fn(resolved),
      apply = vi.fn<(row: ResolutionAccount, patch: AccountPatch) => Promise<'updated'>>(
        async () => 'updated',
      );
    const result = await resolveAccounts(
      noDatabase,
      rows,
      { vimeoToken: 'fixture-token', youtubeApiKey: 'fixture-key' },
      { resolvers: { resolveVimeo, resolveYouTube }, apply },
    );
    expect(result.blocked).toEqual(['vimeo']);
    expect(result.updated).toBe(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[0].platform).toBe('youtube');
    expect(resolveVimeo).toHaveBeenCalledTimes(1);
    expect(resolveYouTube).toHaveBeenCalledTimes(1);
  });
  it('discards pending provider writes and stops queued work after a quota/rate block', async () => {
    let calls = 0;
    const resolveVimeo = vi.fn(async () =>
      ++calls === 1
        ? { resolve_status: 'resolved' as const, external_id: '1', last_error: null }
        : { resolve_status: 'failed' as const, last_error: 'vimeo_rate_limit_deferred' },
    );
    const apply = vi.fn<(row: ResolutionAccount, patch: AccountPatch) => Promise<'updated'>>(
      async () => 'updated',
    );
    const result = await resolveAccounts(
      noDatabase,
      Array.from({ length: 8 }, (_, i) => account(i + 1)),
      { vimeoToken: 'fixture' },
      { resolvers: { resolveVimeo, resolveYouTube: resolved }, probe: passed, apply },
    );
    expect(result.blocked).toEqual(['vimeo']);
    expect(apply).not.toHaveBeenCalled();
    expect(calls).toBeLessThan(8);
  });
  it('skips resolved, invalid, disabled and collected accounts without needless probes', async () => {
    const rows = [
      account(1, { resolve_status: 'resolved' }),
      account(2, { status: 'invalid' }),
      account(3, { status: 'disabled' }),
      account(4, { has_collection: true }),
      account(5, { backfill_cursor: { page: 2 } }),
    ];
    const resolveVimeo = vi.fn(resolved),
      apply = vi.fn<(row: ResolutionAccount, patch: AccountPatch) => Promise<'updated'>>(
        async () => 'updated',
      );
    const result = await resolveAccounts(
      noDatabase,
      rows,
      {},
      { resolvers: { resolveVimeo, resolveYouTube: resolved }, apply },
    );
    expect(result.skipped).toBe(5);
    expect(result.blocked).toEqual([]);
    expect(resolveVimeo).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
  it('records genuine per-account 404 while preserving paused gating for successful rows', async () => {
    const apply = vi.fn<(row: ResolutionAccount, patch: AccountPatch) => Promise<'updated'>>(
      async () => 'updated',
    );
    const result = await resolveAccounts(
      noDatabase,
      [account(1)],
      { vimeoToken: 'fixture' },
      {
        probe: passed,
        resolvers: {
          resolveVimeo: async () => ({
            resolve_status: 'failed',
            status: 'invalid',
            last_error: 'vimeo_404',
          }),
          resolveYouTube: resolved,
        },
        apply,
      },
    );
    expect(result.blocked).toEqual([]);
    expect(apply.mock.calls[0]?.[1]).toEqual({
      resolve_status: 'failed',
      status: 'invalid',
      last_error: 'vimeo_404',
    });
  });
  it('never confuses an unexpected provider exception with invalid account format', async () => {
    const apply = vi.fn<(row: ResolutionAccount, patch: AccountPatch) => Promise<'updated'>>(
      async () => 'updated',
    );
    const result = await resolveAccounts(
      noDatabase,
      [account(1)],
      { vimeoToken: 'fixture' },
      {
        probe: passed,
        resolvers: {
          resolveVimeo: async () => {
            throw new Error('private provider response');
          },
          resolveYouTube: resolved,
        },
        apply,
      },
    );
    expect(result.blocked).toEqual(['vimeo']);
    expect(apply).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private provider response');
  });
  it('bounds Vimeo resolution to two concurrent calls', async () => {
    let active = 0,
      maximum = 0;
    const resolveVimeo = async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return resolved();
    };
    const result = await resolveAccounts(
      noDatabase,
      Array.from({ length: 9 }, (_, i) => account(i + 1)),
      { vimeoToken: 'fixture' },
      { probe: passed, resolvers: { resolveVimeo, resolveYouTube: resolved }, apply: async () => 'updated' },
    );
    expect(maximum).toBe(2);
    expect(result.updated).toBe(9);
  });
  it('reports compare-and-set preservation separately', async () => {
    const result = await resolveAccounts(
      noDatabase,
      [account(1)],
      { vimeoToken: 'fixture' },
      {
        probe: passed,
        resolvers: { resolveVimeo: resolved, resolveYouTube: resolved },
        apply: async () => 'preserved',
      },
    );
    expect(result.preserved).toBe(1);
    expect(result.issues).toContainEqual({
      company_code: 'C001',
      platform: 'vimeo',
      code: 'concurrent_change_preserved',
    });
  });
});

describe('format and website coordination', () => {
  it('limits websites to five, keeps paused flags and rejects cross-domain final URLs', async () => {
    let active = 0,
      maximum = 0;
    const patches: unknown[] = [];
    const rows = Array.from({ length: 11 }, (_, i) =>
      account(i + 1, {
        platform: 'website',
        url: `https://site${i}.com/`,
        handle: `site${i}.com`,
        handle_norm: `site${i}.com`,
        resolve_status: 'not_needed',
      }),
    );
    const result = await checkAccounts(noDatabase, rows, {
      website: async (url) => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise((r) => setTimeout(r, 2));
        active--;
        return {
          resolve_status: 'not_needed',
          last_error: null,
          url: url.includes('site0.') ? 'https://different.com/' : `${url}work`,
        };
      },
      apply: async (_row, patch) => {
        patches.push(patch);
        return 'updated';
      },
    });
    expect(maximum).toBe(5);
    expect(result.updated).toBe(11);
    expect(patches.every((patch) => !('status' in (patch as object)))).toBe(true);
    expect(patches).toContainEqual({ resolve_status: 'not_needed', last_error: 'unreachable_cross_domain' });
  });
  it('validates social formats locally and never performs a social reachability request', async () => {
    const website = vi.fn(async () => ({ resolve_status: 'not_needed' as const, last_error: null }));
    const patches: unknown[] = [];
    const rows = [
      account(1, {
        platform: 'instagram',
        url: 'https://www.instagram.com/good/',
        handle: 'good',
        handle_norm: 'good',
      }),
      account(2, {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/school/not-company/',
        handle: 'not-company',
        handle_norm: 'not-company',
      }),
    ];
    await checkAccounts(noDatabase, rows, {
      website,
      apply: async (_row, patch) => {
        patches.push(patch);
        return 'updated';
      },
    });
    expect(website).not.toHaveBeenCalled();
    expect(patches).toContainEqual({
      resolve_status: 'failed',
      status: 'invalid',
      last_error: 'linkedin_invalid_format',
    });
  });
  it('keeps website timeouts non-invalid and reports safe errors', async () => {
    const patches: unknown[] = [];
    await checkAccounts(noDatabase, [account(1, { platform: 'website', url: 'https://public.com/' })], {
      website: async () => {
        throw new Error('private');
      },
      apply: async (_row, patch) => {
        patches.push(patch);
        return 'updated';
      },
    });
    expect(patches).toEqual([{ resolve_status: 'not_needed', last_error: 'unreachable_network' }]);
  });
});
