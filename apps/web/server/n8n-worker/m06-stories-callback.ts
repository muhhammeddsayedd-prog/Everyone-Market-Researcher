import 'server-only';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { m06StoryActors, m06StoryInternalArgs, type CollectorRequest, type M06StoryActor } from '@emr/shared';
import type { CollectorConfig, CollectorDispatch } from './collectors';
import { WorkerFailure } from './errors';
import dataSlayer from '../../../../n8n/normalizers/storiesDataSlayer.js';
import igview from '../../../../n8n/normalizers/storiesIgview.js';
import louis from '../../../../n8n/normalizers/storiesLouisdeconinck.js';

type Row = Record<string, unknown>;
type Group = {
  account_id: string;
  status: 'success' | 'failed';
  error: string | null;
  items: unknown[];
  bakeoff_rows: unknown[];
};
type StoryNormalizer = (
  rows: unknown[],
  context: Row,
) => { groups: Group[]; errors: unknown[]; unmatched_count: number };
const normalize: Record<M06StoryActor, StoryNormalizer> = {
  'data-slayer/instagram-stories-scraper':
    dataSlayer.prepareStoriesDataSlayerResults as unknown as StoryNormalizer,
  'igview-owner/instagram-story-viewer': igview.prepareStoriesIgviewResults as unknown as StoryNormalizer,
  'louisdeconinck/instagram-story-details-scraper':
    louis.prepareStoriesLouisdeconinckResults as unknown as StoryNormalizer,
};
const object = (v: unknown): v is Row => v !== null && typeof v === 'object' && !Array.isArray(v);
const external = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const bad = () => new WorkerFailure('m06_story_provider_reconciliation_required', 503);
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? '[' + v.map(canonical).join(',') + ']'
    : object(v)
      ? '{' +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
          .join(',') +
        '}'
      : JSON.stringify(v);
function child(id: string, step: string) {
  const h = createHash('sha256')
    .update(JSON.stringify(['m06-story-callback', id, step]))
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
interface Dependencies {
  dispatch: CollectorDispatch;
  get: (path: string, token: string, maxBytes: number, signal: AbortSignal) => Promise<unknown>;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}
function registered(value: unknown, runId: string, config: CollectorConfig) {
  if (
    !object(value) ||
    value.apify_run_id !== runId ||
    !m06StoryActors.includes(value.actor_id as M06StoryActor) ||
    !Array.isArray(value.account_ids) ||
    value.account_ids.length < 1 ||
    value.account_ids.length > 100 ||
    value.account_ids.some((id) => typeof id !== 'string' || !config.accountIds.includes(id)) ||
    new Set(value.account_ids).size !== value.account_ids.length ||
    !Array.isArray(value.accounts) ||
    value.accounts.length !== value.account_ids.length ||
    !value.accounts.every(object) ||
    new Set(value.accounts.map((a) => a.account_id)).size !== value.accounts.length ||
    value.accounts.some((a) => !(value.account_ids as unknown[]).includes(a.account_id)) ||
    !object(value.actor_input) ||
    !uuid(value.run_id) ||
    !uuid(value.launch_id) ||
    typeof value.settled !== 'boolean' ||
    !external(value.build_id) ||
    !Number.isSafeInteger(value.memory_mbytes) ||
    Number(value.memory_mbytes) < 128 ||
    Number(value.memory_mbytes) > 32768 ||
    (Number(value.memory_mbytes) & (Number(value.memory_mbytes) - 1)) !== 0 ||
    !Number.isSafeInteger(value.timeout_secs) ||
    Number(value.timeout_secs) < 30 ||
    Number(value.timeout_secs) > 600 ||
    !Number.isSafeInteger(value.results_limit) ||
    Number(value.results_limit) < 1 ||
    Number(value.results_limit) > 1000 ||
    Number(value.results_limit) * value.account_ids.length > 1000 ||
    typeof value.max_actor_usd !== 'number' ||
    !Number.isFinite(value.max_actor_usd) ||
    value.max_actor_usd <= 0 ||
    value.max_actor_usd > 999999.999999 ||
    !/^\d+(?:\.\d{1,6})?$/.test(String(value.max_actor_usd)) ||
    !['ingest', 'bakeoff'].includes(String(value.collection_mode)) ||
    value.approval_id !== config.policy?.approval_id ||
    typeof value.launch_created_at !== 'string' ||
    !Number.isFinite(Date.parse(value.launch_created_at))
  )
    throw bad();
  return value as Row & {
    actor_id: M06StoryActor;
    account_ids: string[];
    accounts: Row[];
    actor_input: Row;
    results_limit: number;
    settled: boolean;
    build_id: string;
    launch_created_at: string;
    run_id: string;
    launch_id: string;
  };
}

/** Fast durable admission reuses the existing owned job and idempotent register
 * operation. One stable register request per provider run records acceptance;
 * it never starts a provider or claims that ingestion has finished. */
export function createM06StoriesAdmission(deps: Pick<Dependencies, 'dispatch'>) {
  return async (input: CollectorRequest, config: CollectorConfig, signal: AbortSignal): Promise<Row> => {
    if (config.scope !== 'm06' || !external(input.args.apify_run_id))
      throw new WorkerFailure('forbidden', 403);
    const runId = input.args.apify_run_id;
    const lookup = async () => {
      const value = (
        await deps.dispatch(
          child(input.requestId, 'admission-lookup'),
          'm06.lookup',
          { apify_run_id: runId },
          config,
          signal,
        )
      ).result;
      const job = registered(value, runId, config),
        pin = config.policy?.actors[job.actor_id];
      if (!pin || pin.buildId !== job.build_id || (job.settled && !object(job.processing_result)))
        throw bad();
      return job;
    };
    let job = await lookup(),
      replayed = job.settled;
    if (!job.settled) {
      try {
        const receipt = await deps.dispatch(
          child(runId, 'admission-register:' + config.policy!.approval_id),
          'm06.register',
          {
            run_id: job.run_id,
            launch_id: job.launch_id,
            apify_run_id: runId,
            actor_id: job.actor_id,
            pass: 'primary',
            account_ids: job.account_ids,
            purpose: 'daily',
          },
          config,
          signal,
        );
        if (
          !object(receipt.result) ||
          receipt.result.registered !== true ||
          receipt.result.run_id !== job.run_id ||
          receipt.result.apify_run_id !== runId ||
          typeof receipt.replayed !== 'boolean'
        )
          throw bad();
        replayed = receipt.replayed;
      } catch {
        // Settlement can win between lookup and registration. Only its durable
        // completed result permits this bounded race recovery to acknowledge.
        job = await lookup();
        if (!job.settled) throw bad();
        replayed = true;
      }
    }
    return {
      scope: 'm06',
      accepted: true,
      durable: true,
      apify_run_id: runId,
      run_id: job.run_id,
      launch_id: job.launch_id,
      state: job.settled ? 'completed' : 'pending',
      replayed,
    };
  };
}

/** Provider run/INPUT/dataset reads are authoritative. Caller callback bodies
 * supply only a registered ID. No source data, usage or owner is caller selected. */
export function createM06StoriesCallback(deps: Dependencies) {
  return async (input: CollectorRequest, config: CollectorConfig, signal: AbortSignal): Promise<Row> => {
    if (config.scope !== 'm06' || !external(input.args.apify_run_id)) throw bad();
    const runId = input.args.apify_run_id;
    const call = async (step: string, op: keyof typeof m06StoryInternalArgs, args: Row) => {
      let checked: Row;
      try {
        checked = m06StoryInternalArgs[op].parse(args) as Row;
      } catch {
        throw bad();
      }
      return (await deps.dispatch(child(input.requestId, step), op, checked, config, signal)).result;
    };
    const job = registered(await call('lookup', 'm06.lookup', { apify_run_id: runId }), runId, config);
    if (job.settled) {
      if (!object(job.processing_result)) throw bad();
      return { ...job.processing_result, state: 'completed', updated: false, media_dispatch: null };
    }
    const pin = config.policy?.actors[job.actor_id];
    if (!pin || pin.buildId !== job.build_id) throw bad();
    const read = async () => {
      const response = await deps.get('/v2/actor-runs/' + runId, config.apifyReadToken, 65536, signal);
      if (!object(response) || !object(response.data)) throw bad();
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
        Date.parse(d.startedAt) < Date.parse(job.launch_created_at) - 5000
      )
        throw bad();
      return {
        status: String(d.status).replace('TIMED-OUT', 'TIMED_OUT'),
        // Retain only a controlled exclusion flag. Provider free-text errors
        // can contain sensitive transport details and never enter our ledger.
        login_required:
          typeof d.statusMessage === 'string' &&
          !/\bno (?:instagram )?login required\b/i.test(d.statusMessage) &&
          /(?:requires? (?:an? )?(?:instagram )?log ?in|(?:login|checkpoint|captcha|challenge).{0,30}(?:required|detected|blocked)|cookie.{0,30}(?:required|missing|invalid))/i.test(
            d.statusMessage,
          ),
        usage_usd: d.usageTotalUsd,
        dataset_id: external(d.defaultDatasetId) ? d.defaultDatasetId : null,
        kvs_id: d.defaultKeyValueStoreId,
        started_at: d.startedAt,
        finished_at: d.finishedAt,
        cap_acknowledged:
          d.options.maxTotalChargeUsd === Number(job.max_actor_usd) &&
          d.options.memoryMbytes === Number(job.memory_mbytes) &&
          d.options.timeoutSecs === Number(job.timeout_secs),
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
    if (clock() - at < 10000 || canonical(first) !== canonical(terminal)) throw bad();
    const actualInput = await deps.get(
      '/v2/key-value-stores/' + terminal.kvs_id + '/records/INPUT',
      config.apifyReadToken,
      65536,
      signal,
    );
    if (canonical(actualInput) !== canonical({ ...pin.inputDefaults, ...job.actor_input })) throw bad();
    const rows: unknown[] = [];
    let exceeded = false;
    if (
      terminal.status === 'SUCCEEDED' &&
      terminal.cap_acknowledged &&
      terminal.usage_usd <= Number(job.max_actor_usd)
    ) {
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
        if (!Array.isArray(page) || page.length > 500) throw bad();
        if (rows.length + page.length > bound) {
          exceeded = true;
          break;
        }
        rows.push(...page);
        if (page.length < 500) break;
        if (signal.aborted) throw bad();
      }
    }
    let groups: (Group & { observation: 'stories' | 'no_stories' | 'error'; source_evidence: boolean })[];
    const failure = terminal.login_required
      ? 'stories_actor_login_required'
      : terminal.status !== 'SUCCEEDED'
        ? 'stories_actor_' + terminal.status.toLowerCase()
        : !terminal.cap_acknowledged
          ? 'stories_actor_cap_unacknowledged'
          : terminal.usage_usd > Number(job.max_actor_usd)
            ? 'stories_actor_charge_option_exceeded'
            : exceeded
              ? 'stories_dataset_limit_exceeded'
              : null;
    if (failure)
      groups = job.account_ids.map((account_id) => ({
        account_id,
        status: 'failed',
        error: failure,
        items: [],
        bakeoff_rows: [],
        observation: 'error',
        source_evidence: false,
      }));
    else {
      const parsed = normalize[job.actor_id](rows, { accounts: job.accounts, now: terminal.finished_at });
      if (!parsed || !Array.isArray(parsed.groups) || parsed.groups.length !== job.account_ids.length)
        throw bad();
      groups = parsed.groups.map((g) => {
        if (
          !job.account_ids.includes(g.account_id) ||
          !Array.isArray(g.items) ||
          !Array.isArray(g.bakeoff_rows)
        )
          throw bad();
        const success = g.status === 'success' && g.error === null;
        return {
          ...g,
          status: success ? ('success' as const) : ('failed' as const),
          error: success ? null : (g.error ?? 'stories_source_contract_invalid'),
          items: success ? g.items : [],
          bakeoff_rows: success ? g.bakeoff_rows : [],
          observation: success
            ? g.items.length
              ? ('stories' as const)
              : ('no_stories' as const)
            : ('error' as const),
          source_evidence: success,
        };
      });
    }
    // Missing account evidence and provider errors remain failures; an empty
    // successful dataset alone can never manufacture a no-stories observation.
    const result = await call('settle', 'm06.settle', {
      apify_run_id: runId,
      status: terminal.status,
      dataset_id: terminal.dataset_id,
      usage_usd: terminal.usage_usd,
      groups,
      // Comparison day belongs to the source capture, not callback delivery.
      observed_at: terminal.finished_at,
    });
    if (!object(result) || typeof result.updated !== 'boolean') throw bad();
    let newItems = 0;
    if (result.updated && job.collection_mode === 'ingest') {
      if (!Array.isArray(result.groups)) throw bad();
      for (const group of result.groups) {
        if (!object(group) || !Number.isSafeInteger(group.items_new) || Number(group.items_new) < 0)
          throw bad();
        newItems += Number(group.items_new);
      }
      if (newItems > 1000) throw bad();
    }
    // The SQL dispatcher has committed before returning. A wake is only an
    // optimization over this durable dedicated queue; failed child execution
    // never removes messages or makes a source callback replay ingest again.
    return {
      ...result,
      state: 'completed',
      media_dispatch: newItems > 0 ? { queue: 'stories', items_new: newItems } : null,
    };
  };
}
