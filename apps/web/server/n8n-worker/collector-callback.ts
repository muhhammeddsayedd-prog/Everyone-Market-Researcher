import 'server-only';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { CollectorRequest } from '@emr/shared';
import { collectorActors } from '@emr/shared';
import type { CollectorConfig, CollectorDispatch } from './collectors';
import { WorkerFailure } from './errors';
import instagram from '../../../../n8n/normalizers/instagramScraper.js';
import goat from '../../../../n8n/normalizers/goat255.js';
import dltik from '../../../../n8n/normalizers/dltik.js';
import ingestion from '../../../../n8n/normalizers/prepare_ingest_groups.js';
import { createM05Callback } from './m05-callback';
import { createM06StoriesCallback } from './m06-stories-callback';

type Row = Record<string, unknown>;
type Group = {
  account_id: string;
  items: unknown[];
  status: 'success' | 'failed';
  error: string | null;
  backfill_done: boolean;
  backfill_cursor: Row | null;
  normalizer_version: string;
  source_evidence: boolean;
};
const object = (v: unknown): v is Row => v !== null && typeof v === 'object' && !Array.isArray(v);
const external = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const bad = () => new WorkerFailure('provider_reconciliation_required', 503);
function childId(requestId: string, step: string) {
  const h = createHash('sha256')
    .update(JSON.stringify(['m04-callback', requestId, step]))
    .digest('hex');
  return (
    h.slice(0, 8) +
    '-' +
    h.slice(8, 12) +
    '-4' +
    h.slice(13, 16) +
    '-a' +
    h.slice(17, 20) +
    '-' +
    h.slice(20, 32)
  );
}
function registry(value: unknown, runId: string, config: CollectorConfig) {
  if (
    !object(value) ||
    value.apify_run_id !== runId ||
    !collectorActors.includes(value.actor_id as (typeof collectorActors)[number]) ||
    !Array.isArray(value.account_ids) ||
    !value.account_ids.length ||
    value.account_ids.length > 50 ||
    value.account_ids.some((id) => typeof id !== 'string' || !config.accountIds.includes(id)) ||
    !Array.isArray(value.accounts) ||
    value.accounts.length !== value.account_ids.length ||
    !value.accounts.every(object) ||
    !['daily', 'backfill'].includes(String(value.purpose)) ||
    !['primary', 'posts', 'reels'].includes(String(value.pass)) ||
    !Number.isSafeInteger(value.results_limit) ||
    Number(value.results_limit) < 1 ||
    Number(value.results_limit) > 3000 ||
    !Number.isSafeInteger(value.next_offset) ||
    Number(value.next_offset) < 0 ||
    Number(value.next_offset) > 30000 ||
    typeof value.dataset_complete !== 'boolean'
  )
    throw bad();
  const ids = value.account_ids as string[];
  if (
    new Set(ids).size !== ids.length ||
    new Set(value.accounts.map((a) => a.account_id)).size !== ids.length ||
    value.accounts.some((a) => !ids.includes(String(a.account_id)))
  )
    throw bad();
  return value as Row & {
    apify_run_id: string;
    actor_id: (typeof collectorActors)[number];
    account_ids: string[];
    accounts: Row[];
    purpose: 'daily' | 'backfill';
    pass: 'primary' | 'posts' | 'reels';
    results_limit: number;
    next_offset: number;
    dataset_complete: boolean;
    pass_results: Row[];
  };
}
type Registry = ReturnType<typeof registry>;
function snapshot(value: unknown, r: Registry, config: CollectorConfig) {
  const pin = config.policy?.actors[r.actor_id];
  if (!pin || !object(value) || !object(value.data)) throw bad();
  const d = value.data;
  if (
    d.id !== r.apify_run_id ||
    d.actId !== pin.actorId ||
    d.userId !== pin.owner_id ||
    d.buildId !== pin.buildId ||
    d.buildNumber !== pin.build ||
    !['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(String(d.status)) ||
    typeof d.usageTotalUsd !== 'number' ||
    !Number.isFinite(d.usageTotalUsd) ||
    d.usageTotalUsd < 0 ||
    d.usageTotalUsd > 999999.999999 ||
    typeof d.finishedAt !== 'string' ||
    !Number.isFinite(Date.parse(d.finishedAt)) ||
    !external(d.defaultKeyValueStoreId) ||
    typeof d.startedAt !== 'string' ||
    !Number.isFinite(Date.parse(d.startedAt)) ||
    !Number.isFinite(Date.parse(String(r.launch_created_at))) ||
    Date.parse(d.startedAt) < Date.parse(String(r.launch_created_at)) - 5000 ||
    (d.status === 'SUCCEEDED' && !external(d.defaultDatasetId)) ||
    !object(d.options) ||
    d.options.memoryMbytes !== 1024 ||
    d.options.timeoutSecs !== 600 ||
    d.options.maxTotalChargeUsd !== Number(r.max_actor_usd) ||
    d.options.maxItems !== r.results_limit * r.account_ids.length ||
    r.approval_id !== config.policy?.approval_id
  )
    throw bad();
  return {
    id: d.id,
    status: String(d.status).replace('TIMED-OUT', 'TIMED_OUT'),
    dataset_id: external(d.defaultDatasetId) ? d.defaultDatasetId : null,
    kvs_id: d.defaultKeyValueStoreId,
    usage_usd: d.usageTotalUsd,
    finished_at: d.finishedAt,
    actor_id: d.actId,
    build_id: d.buildId,
  };
}
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : object(value)
      ? '{' +
        Object.keys(value)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
          .join(',') +
        '}'
      : JSON.stringify(value);
function verifyInput(value: unknown, r: Registry, config: CollectorConfig) {
  if (!object(value)) throw bad();
  const publicOnly = (input: unknown, depth = 0): void => {
    if (depth > 32) throw bad();
    if (Array.isArray(input)) {
      input.forEach((v) => publicOnly(v, depth + 1));
    } else if (object(input)) {
      for (const [key, child] of Object.entries(input)) {
        if (
          /cookie|session|password|auth|token|api.?key|secret|login|download|transcri|audio|video.?file/i.test(
            key,
          )
        )
          throw bad();
        publicOnly(child, depth + 1);
      }
    }
  };
  publicOnly(value);
  const accounts = contextAccounts(r);
  let expected: Row;
  if (r.actor_id === 'apify/instagram-scraper') {
    const dates = accounts
      .map((a) =>
        instagram
          .instagramCutoff({ ...a, last_item_published_at: a.watermark_published_at }, r.purpose)
          .slice(0, 10),
      )
      .sort();
    expected = {
      directUrls: accounts.map(
        (a) => 'https://www.instagram.com/' + String(a.handle).replace(/^@/, '').toLowerCase() + '/',
      ),
      resultsType: r.pass,
      resultsLimit: r.results_limit,
      onlyPostsNewerThan: dates[0],
      ...(r.pass === 'posts' ? { skipPinnedPosts: true } : {}),
      addParentData: false,
    };
  } else if (r.actor_id === 'goat255/vimeo-scraper')
    expected = {
      videoUrls: [],
      users: accounts.map((a) => a.url),
      maxVideosPerUser: r.results_limit,
      includeProfile: false,
      concurrency: 1,
    };
  else expected = { urls: accounts.map((a) => a.url), maxResults: r.results_limit };
  const defaults = config.policy?.actors[r.actor_id]?.inputDefaults ?? {};
  for (const [key, actual] of Object.entries(value)) {
    if (/cookie|session|password|authorization|access.?token|login/i.test(key)) throw bad();
    const source = Object.hasOwn(expected, key) ? expected : defaults;
    if (!Object.hasOwn(source, key)) throw bad();
    if (['directUrls', 'users', 'urls'].includes(key)) {
      if (
        !Array.isArray(actual) ||
        !Array.isArray(source[key]) ||
        canonical([...actual].sort()) !== canonical([...(source[key] as unknown[])].sort())
      )
        throw bad();
    } else if (canonical(actual) !== canonical(source[key])) throw bad();
  }
  if (Object.keys(expected).some((k) => !Object.hasOwn(value, k))) throw bad();
}
function contextAccounts(r: Registry): Row[] {
  return r.accounts.map((a): Row => ({
    ...a,
    backfill_cursor:
      object(a.backfill_cursor) && object(a.backfill_cursor[r.pass])
        ? a.backfill_cursor[r.pass]
        : a.backfill_cursor,
  }));
}
function normalizePage(rows: unknown[], r: Registry): Group[] {
  const accounts = contextAccounts(r);
  if (r.actor_id === 'apify/instagram-scraper') {
    const result = instagram.prepareInstagramResults(rows, {
      accounts,
      mode: r.purpose,
      result_type: r.pass,
      resultsLimit: r.results_limit,
      // A trusted launch timestamp fixes the metrics horizon across callback
      // retries, UTC midnight and paginated dataset reads.
      now: String(r.launch_created_at),
    });
    return result.groups.map((g: Row) => ({
      account_id: String(g.account_id),
      items: g.items as unknown[],
      status: g.error === 'ig_no_account_evidence' ? 'success' : (g.status as 'success' | 'failed'),
      error: g.error === 'ig_no_account_evidence' ? null : (g.error as string | null),
      backfill_done: false,
      backfill_cursor: g.backfill_cursor as Row | null,
      normalizer_version: 'instagram-scraper.v1',
      source_evidence: g.status === 'success' && g.error === null,
    }));
  }
  return accounts.map((a) => {
    const cutoff =
      r.purpose === 'backfill'
        ? '2024-01-01T00:00:00.000Z'
        : new Date(Date.parse(String(a.watermark_published_at)) - 86400000).toISOString();
    const normalizer =
      r.actor_id === 'goat255/vimeo-scraper' ? goat.normalizeGoat255Result : dltik.normalizeDltikResult;
    const result = normalizer(rows, { account: a, cutoff });
    const failed =
      result.errors.length > 0 ||
      rows.some((row) => object(row) && row.type !== 'profile' && !Object.hasOwn(row, 'privacy'));
    return {
      account_id: String(a.account_id),
      items: failed ? [] : result.items,
      status: failed ? ('failed' as const) : ('success' as const),
      error: failed ? 'vimeo_contract_drift' : null,
      backfill_done: false,
      backfill_cursor: null,
      normalizer_version: r.actor_id === 'goat255/vimeo-scraper' ? 'goat255.v1' : 'dltik.v1',
      source_evidence: !failed && normalizer(rows, { account: a }).items.length > 0,
    };
  });
}
interface Dependencies {
  dispatch: CollectorDispatch;
  get: (path: string, token: string, maxBytes: number, signal: AbortSignal) => Promise<unknown>;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}
/** One bounded immutable dataset page per call; registration and both-pass
 * ownership live in SQL. Callback fields never supply status/data/cost.
 */
export function createCollectorCallback(deps: Dependencies) {
  const m05 = createM05Callback(deps);
  const m06 = createM06StoriesCallback(deps);
  return async (input: CollectorRequest, config: CollectorConfig, signal: AbortSignal) => {
    if (config.scope === 'm05') return m05(input, config, signal);
    if (config.scope === 'm06') return m06(input, config, signal);
    const runId = input.args.apify_run_id;
    if (!external(runId)) throw bad();
    const call = async (step: string, operation: string, args: Row) =>
      (await deps.dispatch(childId(input.requestId, step), operation, args, config, signal)).result;
    let r = registry(await call('lookup', 'lookup', { apify_run_id: runId }), runId, config);
    if (r.processed_at !== null) {
      if (!object(r.processing_result)) throw bad();
      return { ...r.processing_result, state: 'completed', updated: false };
    }
    const now = deps.now ?? (() => performance.now());
    const first = snapshot(
        await deps.get('/v2/actor-runs/' + runId, config.apifyReadToken, 65536, signal),
        r,
        config,
      ),
      at = now();
    await (
      deps.wait ??
      (async (ms, s) => {
        await delay(ms, undefined, { signal: s });
      })
    )(10000, signal);
    const second = snapshot(
      await deps.get('/v2/actor-runs/' + runId, config.apifyReadToken, 65536, signal),
      r,
      config,
    );
    if (now() - at < 10000 || JSON.stringify(first) !== JSON.stringify(second)) throw bad();
    const terminal = second;
    verifyInput(
      await deps.get(
        '/v2/key-value-stores/' + terminal.kvs_id + '/records/INPUT',
        config.apifyReadToken,
        65536,
        signal,
      ),
      r,
      config,
    );
    if (terminal.status === 'SUCCEEDED' && !r.dataset_complete) {
      const rows = await deps.get(
        '/v2/datasets/' +
          terminal.dataset_id +
          '/items?format=json&offset=' +
          r.next_offset +
          '&limit=500&skipHidden=true',
        config.apifyReadToken,
        4194304,
        signal,
      );
      if (!Array.isArray(rows) || rows.length > 500) throw bad();
      const exceeds = r.next_offset + rows.length > r.results_limit * r.account_ids.length;
      const groups = exceeds
        ? r.accounts.map((a) => ({
            account_id: String(a.account_id),
            items: [],
            status: 'failed',
            error: 'collector_dataset_limit_exceeded',
            backfill_done: false,
            backfill_cursor: null,
            normalizer_version:
              r.actor_id === 'apify/instagram-scraper'
                ? 'instagram-scraper.v1'
                : r.actor_id === 'goat255/vimeo-scraper'
                  ? 'goat255.v1'
                  : 'dltik.v1',
            source_evidence: false,
          }))
        : normalizePage(rows, r);
      for (const g of groups) {
        const safe = ingestion.prepareIngestGroups([{ account_id: g.account_id, items: g.items }]);
        if (!Array.isArray(safe) || !object(safe[0]) || safe[0].items_dropped !== 0) throw bad();
      }
      const staged = await call('page-' + r.next_offset, 'stage', {
        apify_run_id: runId,
        offset: r.next_offset,
        raw_count: exceeds ? 0 : rows.length,
        has_more: !exceeds && rows.length === 500,
        groups,
      });
      if (
        !object(staged) ||
        typeof staged.dataset_complete !== 'boolean' ||
        !Number.isSafeInteger(staged.next_offset)
      )
        throw new WorkerFailure('provider_page_receipt_invalid', 503);
      if (!staged.dataset_complete)
        return { state: 'pending', apify_run_id: runId, next_offset: staged.next_offset };
      r = registry(await call('final-lookup', 'lookup', { apify_run_id: runId }), runId, config);
      if (r.processed_at !== null) {
        if (!object(r.processing_result)) throw bad();
        return { ...r.processing_result, state: 'completed', updated: false };
      }
    }
    const contexts = contextAccounts(r);
    const groups = contexts.map((a) => {
      const p = Array.isArray(r.pass_results)
        ? r.pass_results.find((p) => object(p) && p.account_id === a.account_id)
        : null;
      if (!p) throw new WorkerFailure('provider_pass_context_invalid', 503);
      // SQL retains normalized item counts, not raw per-account counts. The
      // batch raw count is a conservative saturation bound: if it reaches one
      // profile's limit, that profile might have been truncated. Never infer
      // complete history or daily coverage from filtered/normalized counts.
      const possiblyCapped = r.next_offset >= r.results_limit;
      const dailyCapped = r.purpose === 'daily' && possiblyCapped;
      const failure =
        terminal.status !== 'SUCCEEDED' ||
        p.stage_status === 'failed' ||
        p.source_evidence !== true ||
        dailyCapped;
      const prior = object(a.backfill_cursor) ? a.backfill_cursor : {};
      const sourceCursor = object(p.backfill_cursor) ? p.backfill_cursor : {};
      const full = possiblyCapped;
      const cursor =
        r.purpose === 'backfill'
          ? {
              ...sourceCursor,
              full_waves: full ? Number(prior.full_waves ?? 0) + 1 : 0,
              results_limit: r.results_limit,
              history_state: full && r.results_limit === 3000 ? 'limit_exhausted' : 'incomplete',
              strategy: 'latest_limit_escalation',
              resume_supported: false,
            }
          : null;
      // Dataset EOF drains captured output; it does not attest full source traversal.
      // A larger latest-results limit and SUCCEEDED provide no per-profile stop
      // reason in the pinned contract. Preserve successful bounded work/cost, but
      // keep history incomplete until supported coverage evidence is available.
      // https://docs.apify.com/api/v2/dataset-items-get
      return {
        account_id: String(a.account_id),
        items: [],
        normalizer_version:
          r.actor_id === 'apify/instagram-scraper'
            ? 'instagram-scraper.v1'
            : r.actor_id === 'goat255/vimeo-scraper'
              ? 'goat255.v1'
              : 'dltik.v1',
        status: failure ? 'failed' : 'success',
        error: failure
          ? typeof p.error === 'string'
            ? p.error
            : dailyCapped
              ? 'collector_daily_coverage_capped'
              : terminal.status !== 'SUCCEEDED'
                ? 'apify_' + terminal.status.toLowerCase()
                : 'collector_no_account_evidence'
          : null,
        backfill_done: false,
        backfill_cursor: cursor,
      };
    });
    const result = await call('settle', 'settle', {
      apify_run_id: runId,
      status: terminal.status,
      dataset_id: terminal.dataset_id,
      usage_usd: terminal.usage_usd,
      groups,
    });
    if (!object(result) || typeof result.updated !== 'boolean')
      throw new WorkerFailure('provider_settlement_receipt_invalid', 503);
    return { ...result, state: 'completed' };
  };
}
