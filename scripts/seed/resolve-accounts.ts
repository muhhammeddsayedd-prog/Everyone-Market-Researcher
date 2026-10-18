import type { Sql, TransactionSql } from 'postgres';
import {
  normalizeInstagram,
  normalizeLinkedIn,
  normalizeVimeo,
  normalizeWebsite,
  normalizeYouTube,
} from '@emr/shared';
import { accountUntouched, applyAccountPatch, type AccountPatch, type ResolutionAccount } from './database';
import {
  checkWebsite,
  createProviderResolvers,
  validateInstagram,
  validateLinkedIn,
  type ResolutionPatch,
  type WebsiteCheck,
} from './providers';

export type ProviderCredentials = { vimeoToken?: string; youtubeApiKey?: string };
type Resolvers = ReturnType<typeof createProviderResolvers>;
type Provider = 'vimeo' | 'youtube';
type SafeIssue = { company_code: string; platform: string; code: string };
export type ProbeEntry = {
  status: 'passed' | 'missing' | 'blocked' | 'unneeded';
  code?: string;
  sampleAccountId?: string;
  sampleCompanyCode?: string;
  patch?: ResolutionPatch;
};
export type ProviderProbe = { vimeo: ProbeEntry; youtube: ProbeEntry };
type Dependencies = {
  resolvers?: Resolvers;
  signal?: AbortSignal;
  probe?: ProviderProbe;
  apply?: (row: ResolutionAccount, patch: AccountPatch) => Promise<'updated' | 'unchanged' | 'preserved'>;
};
export type AccountBatchResult = {
  attempted: number;
  updated: number;
  unchanged: number;
  preserved: number;
  skipped: number;
  blocked: Provider[];
  issues: SafeIssue[];
};

const safeCode = (code: string | null | undefined) =>
  code && /^[a-z0-9_]{1,80}$/.test(code) ? code : 'provider_failure';
const terminalAccountErrors = new Set([
  'vimeo_404',
  'yt_404',
  'yt_not_found',
  'yt_custom_url_unresolved',
  'vimeo_invalid_format',
  'yt_invalid_format',
]);
const blocking = (patch: ResolutionPatch) =>
  patch.resolve_status !== 'resolved' && !terminalAccountErrors.has(patch.last_error ?? '');
const initialResult = (): AccountBatchResult => ({
  attempted: 0,
  updated: 0,
  unchanged: 0,
  preserved: 0,
  skipped: 0,
  blocked: [],
  issues: [],
});

/** Non-mutating known-public-account probes. Provider settings and account ownership are separate facts. */
export async function probeProviders(
  rows: ResolutionAccount[],
  credentials: ProviderCredentials,
  options: { resolvers?: Resolvers; signal?: AbortSignal; requested?: Provider[] } = {},
): Promise<ProviderProbe> {
  const resolvers = options.resolvers ?? createProviderResolvers({ signal: options.signal });
  const requested = options.requested ?? ['vimeo', 'youtube'];
  const probe: ProviderProbe = { vimeo: { status: 'unneeded' }, youtube: { status: 'unneeded' } };
  for (const provider of requested) {
    const credential = provider === 'vimeo' ? credentials.vimeoToken : credentials.youtubeApiKey;
    if (!credential) {
      probe[provider] = {
        status: 'missing',
        code: provider === 'vimeo' ? 'vimeo_missing_token' : 'yt_missing_key',
      };
      continue;
    }
    if (options.signal?.aborted) {
      probe[provider] = { status: 'blocked', code: 'provider_aborted' };
      continue;
    }
    const sample = rows.find((row) =>
      provider === 'vimeo'
        ? row.platform === 'vimeo' && row.company_code === 'C000' && row.handle_norm === 'everyonefilms'
        : row.platform === 'youtube' && row.handle_norm === '@aflamproductions',
    );
    let patch: ResolutionPatch;
    try {
      patch =
        provider === 'vimeo'
          ? await resolvers.resolveVimeo({ kind: 'user', handle: 'everyonefilms' }, credential)
          : await resolvers.resolveYouTube({ kind: 'handle', value: 'aflamproductions' }, credential);
    } catch {
      probe[provider] = { status: 'blocked', code: 'provider_failure' };
      continue;
    }
    // A failed known-account lookup is a preflight blocker, never evidence against every CSV account.
    probe[provider] =
      patch.resolve_status === 'resolved'
        ? {
            status: 'passed',
            patch,
            ...(sample ? { sampleAccountId: sample.id, sampleCompanyCode: sample.company_code } : {}),
          }
        : { status: 'blocked', code: safeCode(patch.last_error) };
  }
  return probe;
}

async function parallel<T>(
  rows: T[],
  maximum: number,
  run: (row: T) => Promise<void>,
  stopped: () => boolean = () => false,
) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(maximum, rows.length) }, async () => {
      while (!stopped()) {
        const row = rows[index++];
        if (row === undefined) return;
        await run(row);
      }
    }),
  );
}

function eligible(row: ResolutionAccount) {
  return (
    row.resolve_status !== 'resolved' &&
    !['invalid', 'disabled'].includes(row.status) &&
    accountUntouched(row) &&
    row.backfill_cursor === null
  );
}

/** All tiers resolve; bounded provider failures stop only that provider and leave its rows untouched. */
export async function resolveAccounts(
  sql: Sql | TransactionSql,
  rows: ResolutionAccount[],
  credentials: ProviderCredentials,
  dependencies: Dependencies = {},
): Promise<AccountBatchResult> {
  const result = initialResult();
  const resolvers = dependencies.resolvers ?? createProviderResolvers({ signal: dependencies.signal });
  const candidates = rows.filter((row) => ['vimeo', 'youtube'].includes(row.platform) && eligible(row));
  result.skipped =
    rows.filter((row) => ['vimeo', 'youtube'].includes(row.platform)).length - candidates.length;
  const requested = (['vimeo', 'youtube'] as const).filter((provider) =>
    candidates.some((row) => row.platform === provider),
  );
  const probe =
    dependencies.probe ??
    (await probeProviders(rows, credentials, { resolvers, signal: dependencies.signal, requested }));
  const apply = dependencies.apply ?? ((row, patch) => applyAccountPatch(sql, row, patch));
  for (const provider of requested) {
    const entry = probe[provider];
    if (entry.status !== 'passed') {
      result.blocked.push(provider);
      result.issues.push({ company_code: 'provider', platform: provider, code: safeCode(entry.code) });
      continue;
    }
    const pending = candidates.filter((row) => row.platform === provider);
    const patches: Array<{ row: ResolutionAccount; patch: ResolutionPatch }> = [];
    let stopped = false;
    await parallel(
      pending,
      2,
      async (row) => {
        if (dependencies.signal?.aborted) {
          stopped = true;
          result.issues.push({
            company_code: row.company_code,
            platform: provider,
            code: 'provider_aborted',
          });
          return;
        }
        let patch: ResolutionPatch;
        if (row.id === entry.sampleAccountId && entry.patch) {
          patch = entry.patch;
          result.attempted++;
        } else {
          let input: ReturnType<typeof normalizeVimeo> | ReturnType<typeof normalizeYouTube> | undefined;
          try {
            input = provider === 'vimeo' ? normalizeVimeo(row.url) : normalizeYouTube(row.url);
          } catch {}
          if (!input)
            patch = {
              resolve_status: 'failed',
              status: 'invalid',
              last_error: provider === 'vimeo' ? 'vimeo_invalid_format' : 'yt_invalid_format',
            };
          else {
            try {
              patch =
                provider === 'vimeo'
                  ? await resolvers.resolveVimeo(
                      input as ReturnType<typeof normalizeVimeo>,
                      credentials.vimeoToken!,
                    )
                  : await resolvers.resolveYouTube(
                      input as ReturnType<typeof normalizeYouTube>,
                      credentials.youtubeApiKey!,
                    );
            } catch {
              patch = { resolve_status: 'failed', last_error: 'provider_failure' };
            }
            result.attempted++;
          }
        }
        if (blocking(patch)) {
          stopped = true;
          result.issues.push({
            company_code: row.company_code,
            platform: provider,
            code: safeCode(patch.last_error),
          });
          return;
        }
        patches.push({ row, patch });
      },
      () => stopped,
    );
    if (stopped) {
      result.blocked.push(provider);
      continue;
    }
    for (const { row, patch } of patches) {
      const outcome = await apply(row, patch);
      result[outcome]++;
      if (outcome === 'preserved')
        result.issues.push({
          company_code: row.company_code,
          platform: provider,
          code: 'concurrent_change_preserved',
        });
      else if (patch.last_error)
        result.issues.push({
          company_code: row.company_code,
          platform: provider,
          code: safeCode(patch.last_error),
        });
    }
  }
  return result;
}

/** Format-only social validation and at most five public website checks; statuses stay gated. */
export async function checkAccounts(
  sql: Sql | TransactionSql,
  rows: ResolutionAccount[],
  dependencies: {
    website?: (url: string) => Promise<WebsiteCheck>;
    signal?: AbortSignal;
    apply?: Dependencies['apply'];
  } = {},
): Promise<AccountBatchResult> {
  const result = initialResult();
  const apply = dependencies.apply ?? ((row, patch) => applyAccountPatch(sql, row, patch));
  const website = dependencies.website ?? ((url) => checkWebsite(url, { signal: dependencies.signal }));
  const selected = rows.filter((row) =>
    [
      'instagram',
      'instagram_stories',
      'linkedin',
      'linkedin_employees',
      'website',
      'website_work_page',
    ].includes(row.platform),
  );
  await parallel(selected, 5, async (row) => {
    if (
      dependencies.signal?.aborted ||
      ['invalid', 'disabled'].includes(row.status) ||
      !accountUntouched(row)
    ) {
      result.skipped++;
      return;
    }
    let patch: AccountPatch;
    if (row.platform.startsWith('instagram')) {
      let valid = false;
      try {
        valid = validateInstagram(row.handle) && normalizeInstagram(row.url) === row.handle_norm;
      } catch {}
      patch = valid
        ? { resolve_status: 'not_needed', last_error: null }
        : { resolve_status: 'failed', status: 'invalid', last_error: 'instagram_invalid_format' };
    } else if (row.platform.startsWith('linkedin')) {
      let valid = false;
      try {
        const normalized = normalizeLinkedIn(row.url);
        valid = validateLinkedIn(normalized) && normalized.slug === row.handle_norm;
      } catch {}
      patch = valid
        ? { resolve_status: 'not_needed', last_error: null }
        : { resolve_status: 'failed', status: 'invalid', last_error: 'linkedin_invalid_format' };
    } else {
      let checked: WebsiteCheck;
      try {
        checked = await website(row.url);
      } catch {
        checked = { resolve_status: 'not_needed', last_error: 'unreachable_network' };
      }
      patch = { resolve_status: 'not_needed', last_error: checked.last_error };
      if (checked.url) {
        try {
          const initial = normalizeWebsite(row.url),
            final = normalizeWebsite(checked.url);
          if (initial.domain === final.domain) patch.url = final.url;
          else patch.last_error = 'unreachable_cross_domain';
        } catch {
          patch.last_error = 'unreachable_unsafe_url';
        }
      }
    }
    result.attempted++;
    const outcome = await apply(row, patch);
    result[outcome]++;
    if (outcome === 'preserved')
      result.issues.push({
        company_code: row.company_code,
        platform: row.platform,
        code: 'concurrent_change_preserved',
      });
    else if (patch.last_error)
      result.issues.push({
        company_code: row.company_code,
        platform: row.platform,
        code: safeCode(patch.last_error),
      });
  });
  return result;
}
