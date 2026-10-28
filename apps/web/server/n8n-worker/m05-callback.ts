import 'server-only';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { CollectorRequest } from '@emr/shared';
import { m05Actors } from '@emr/shared';
import type { CollectorConfig, CollectorDispatch } from './collectors';
import { WorkerFailure } from './errors';
import websiteModule from '../../../../n8n/normalizers/websiteContentCrawler.js';
import postsModule from '../../../../n8n/normalizers/linkedinPosts.js';
import employeesModule from '../../../../n8n/normalizers/linkedinEmployees.js';

type Row = Record<string, unknown>;
type Group = Row & { account_id: string; status: string; items?: unknown[] };
const website = websiteModule as unknown as {
  prepareWebsiteResults: (rows: unknown[], context: Row) => { group: Group };
};
const posts = postsModule as unknown as {
  prepareLinkedInPostResults: (rows: unknown[], context: Row) => { groups: Group[] };
};
const employees = employeesModule as unknown as {
  prepareLinkedInEmployeeResults: (rows: unknown[], context: Row) => { groups: Group[] };
};
const object = (v: unknown): v is Row => v !== null && typeof v === 'object' && !Array.isArray(v);
const external = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const fail = () => new WorkerFailure('m05_provider_reconciliation_required', 503);
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
function child(id: string, step: string) {
  const h = createHash('sha256')
    .update(JSON.stringify(['m05-callback', id, step]))
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
interface Dependencies {
  dispatch: CollectorDispatch;
  get: (path: string, token: string, maxBytes: number, signal: AbortSignal) => Promise<unknown>;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  wallTime?: () => string;
}
function registered(value: unknown, runId: string, config: CollectorConfig) {
  if (
    !object(value) ||
    value.apify_run_id !== runId ||
    !m05Actors.includes(value.actor_id as (typeof m05Actors)[number]) ||
    !Array.isArray(value.account_ids) ||
    !value.account_ids.length ||
    value.account_ids.length > 20 ||
    value.account_ids.some((id) => typeof id !== 'string' || !config.accountIds.includes(id)) ||
    new Set(value.account_ids).size !== value.account_ids.length ||
    !Array.isArray(value.accounts) ||
    value.accounts.length !== value.account_ids.length ||
    !value.accounts.every(object) ||
    new Set(value.accounts.map((a) => a.account_id)).size !== value.account_ids.length ||
    value.accounts.some(
      (a) => !value.account_ids || !(value.account_ids as unknown[]).includes(a.account_id),
    ) ||
    !object(value.actor_input) ||
    typeof value.settled !== 'boolean' ||
    !Number.isSafeInteger(value.results_limit) ||
    Number(value.results_limit) < 1 ||
    Number(value.results_limit) > 1000 ||
    !['daily', 'backfill', 'weekly'].includes(String(value.purpose)) ||
    value.approval_id !== config.policy?.approval_id ||
    !external(value.launch_id?.toString().replaceAll('-', ''))
  )
    throw fail();
  return value as Row & {
    actor_id: (typeof m05Actors)[number];
    accounts: Row[];
    account_ids: string[];
    actor_input: Row;
    results_limit: number;
    settled: boolean;
    launch_id: string;
    run_id: string;
    purpose: string;
  };
}
/** Registered actor state, KVS INPUT and measured usage are authoritative.
 * No callback-body datasets, costs, ownership or employee fields are trusted.
 * This is an additive product callback; it does not reopen the M03 supervisor.
 */
export function createM05Callback(deps: Dependencies) {
  return async (input: CollectorRequest, config: CollectorConfig, signal: AbortSignal) => {
    if (config.scope !== 'm05' || !external(input.args.apify_run_id)) throw fail();
    const runId = input.args.apify_run_id;
    const call = async (step: string, operation: string, args: Row) =>
      (await deps.dispatch(child(input.requestId, step), operation, args, config, signal)).result;
    const job = registered(await call('lookup', 'm05.lookup', { apify_run_id: runId }), runId, config);
    const retryResult = (result: Row) => {
      const urls = result.retry_urls;
      if (Array.isArray(urls) && urls.length) {
        if (
          job.actor_id !== 'apify/website-content-crawler' ||
          job.account_ids.length !== 1 ||
          job.retry_of !== null ||
          urls.some((u) => typeof u !== 'string')
        )
          throw fail();
        return {
          ...result,
          state: 'retry_required',
          retry: {
            run_id: job.run_id,
            retry_of: job.launch_id,
            launch_id: child(job.launch_id, 'thin-retry'),
            actor_id: job.actor_id,
            pass: 'primary',
            account_ids: job.account_ids,
            purpose: job.purpose,
            results_limit: urls.length,
            urls,
            crawler_type: 'playwright:adaptive',
            actor_input: {
              ...job.actor_input,
              startUrls: urls.map((url) => ({ url })),
              crawlerType: 'playwright:adaptive',
              maxCrawlPages: urls.length,
              maxResults: urls.length,
            },
          },
        };
      }
      return { ...result, state: 'completed' };
    };
    if (job.settled) {
      if (!object(job.result)) throw fail();
      // A retry intent admitted earlier is owned by its own immutable registry.
      // Replaying the primary callback after account release performs no launch.
      if (job.retry_pending === false && Array.isArray(job.result.retry_urls) && job.result.retry_urls.length)
        return { ...job.result, state: 'completed', updated: false, retry_intent_reserved: true };
      return retryResult({ ...job.result, updated: false });
    }
    const pin = config.policy?.actors[job.actor_id];
    if (!pin) throw fail();
    const read = async () => {
      const response = await deps.get('/v2/actor-runs/' + runId, config.apifyReadToken, 65536, signal);
      if (!object(response) || !object(response.data)) throw fail();
      const d = response.data;
      if (
        d.id !== runId ||
        d.actId !== pin.actorId ||
        d.userId !== pin.owner_id ||
        d.buildId !== pin.buildId ||
        d.buildNumber !== pin.build ||
        !['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(String(d.status)) ||
        typeof d.usageTotalUsd !== 'number' ||
        !Number.isFinite(d.usageTotalUsd) ||
        d.usageTotalUsd < 0 ||
        d.usageTotalUsd > 999999.999999 ||
        !external(d.defaultKeyValueStoreId) ||
        (d.status === 'SUCCEEDED' && !external(d.defaultDatasetId)) ||
        !object(d.options) ||
        typeof d.startedAt !== 'string' ||
        typeof d.finishedAt !== 'string' ||
        !Number.isFinite(Date.parse(d.startedAt)) ||
        !Number.isFinite(Date.parse(d.finishedAt)) ||
        Date.parse(d.finishedAt) < Date.parse(d.startedAt) ||
        Date.parse(d.startedAt) < Date.parse(String(job.created_at)) - 5000
      )
        throw fail();
      return {
        status: String(d.status).replace('TIMED-OUT', 'TIMED_OUT'),
        dataset_id: d.defaultDatasetId,
        kvs_id: d.defaultKeyValueStoreId,
        usage_usd: d.usageTotalUsd,
        // Current Run Actor API documents maxTotalChargeUsd for ALL pricing
        // models. maxItems is a PPR charge count, not an output-size guarantee.
        // https://docs.apify.com/api/v2/actors-runs-post
        cap_acknowledged:
          d.options.memoryMbytes === 1024 &&
          d.options.timeoutSecs === 600 &&
          d.options.maxTotalChargeUsd === Number(job.max_actor_usd) &&
          (pin.billingModel !== 'PPU' || d.options.isMaxTotalChargeUsdSetByUser === true),
        started_at: d.startedAt,
        finished_at: d.finishedAt,
      };
    };
    const first = await read(),
      clock = deps.now ?? (() => performance.now()),
      at = clock();
    await (
      deps.wait ??
      (async (ms, s) => {
        await delay(ms, undefined, { signal: s });
      })
    )(10000, signal);
    const terminal = await read();
    if (clock() - at < 10000 || canonical(first) !== canonical(terminal)) throw fail();
    const actualInput = await deps.get(
      '/v2/key-value-stores/' + terminal.kvs_id + '/records/INPUT',
      config.apifyReadToken,
      65536,
      signal,
    );
    // Provider-owned default fields may appear only if explicitly pinned in the
    // approved build. They cannot introduce credentials, private access or AI.
    const expected = { ...(pin.inputDefaults ?? {}), ...job.actor_input };
    if (canonical(actualInput) !== canonical(expected)) throw fail();
    const rows: unknown[] = [];
    let overOutput = false;
    if (terminal.status === 'SUCCEEDED' && terminal.cap_acknowledged) {
      const bound = job.results_limit * job.account_ids.length;
      for (let offset = 0; offset <= bound; offset += 500) {
        const page = await deps.get(
          '/v2/datasets/' +
            terminal.dataset_id +
            '/items?format=json&offset=' +
            offset +
            '&limit=500&skipHidden=true',
          config.apifyReadToken,
          4194304,
          signal,
        );
        if (!Array.isArray(page) || page.length > 500) throw fail();
        if (rows.length + page.length > bound) {
          overOutput = true;
          break;
        }
        rows.push(...page);
        if (page.length < 500) break;
        if (signal.aborted) throw fail();
      }
    }
    const now = (deps.wallTime ?? (() => new Date().toISOString()))();
    let groups: Group[];
    if (terminal.status !== 'SUCCEEDED' || overOutput || !terminal.cap_acknowledged)
      groups = job.account_ids.map((account_id) => ({
        account_id,
        status: 'failed',
        items: [],
        people: [],
        pages: [],
        retry_urls: [],
        error: !terminal.cap_acknowledged
          ? 'm05_actor_cap_unacknowledged'
          : overOutput
            ? 'm05_dataset_limit_exceeded'
            : 'apify_' + terminal.status.toLowerCase(),
        backfill_cursor: null,
      }));
    else
      try {
        if (job.actor_id === 'apify/website-content-crawler') {
          if (job.accounts.length !== 1 || !Array.isArray(job.urls)) throw fail();
          groups = [
            website.prepareWebsiteResults(rows, {
              account: job.accounts[0],
              requestedUrls: job.urls,
              mode: job.purpose,
              now,
              crawlerType: job.crawler_type,
              retryAttempt: job.retry_of === null ? 0 : 1,
            }).group,
          ];
        } else if (job.actor_id === 'harvestapi/linkedin-company-posts') {
          groups = posts.prepareLinkedInPostResults(rows, {
            accounts: job.accounts,
            mode: job.purpose,
            now,
            maxPosts: job.results_limit,
          }).groups;
        } else
          groups = employees.prepareLinkedInEmployeeResults(rows, {
            accounts: job.accounts,
            input: job.actor_input,
          }).groups;
      } catch {
        // Unknown source shapes are a failed, costed observation. No untrusted raw
        // employee profile, foreign-owner item or guessed history is persisted.
        groups = job.account_ids.map((account_id) => ({
          account_id,
          status: 'failed',
          items: [],
          people: [],
          pages: [],
          retry_urls: [],
          error: 'm05_source_contract_unverified',
          backfill_cursor: null,
        }));
      }
    if (
      groups.length !== job.account_ids.length ||
      new Set(groups.map((g) => g.account_id)).size !== groups.length ||
      groups.some((g) => !job.account_ids.includes(g.account_id))
    )
      throw fail();
    const result = await call('settle', 'm05.settle', {
      apify_run_id: runId,
      status: terminal.status,
      dataset_id: terminal.dataset_id ?? null,
      usage_usd: terminal.usage_usd,
      groups,
    });
    if (!object(result) || typeof result.updated !== 'boolean') throw fail();
    return {
      ...retryResult(result),
      requires_review:
        !terminal.cap_acknowledged ||
        overOutput ||
        groups.some((g) => g.error === 'm05_source_contract_unverified'),
    };
  };
}
