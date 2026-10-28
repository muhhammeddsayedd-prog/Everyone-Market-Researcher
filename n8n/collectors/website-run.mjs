import { createHash } from 'node:crypto';
import {
  buildWebsiteMapRequest,
  parseWebsiteMapResponse,
  buildWebsiteCrawlerBatches,
  websiteSourceOptions,
  selectWebsitePending,
} from './website.mjs';
import website from '../normalizers/websiteContentCrawler.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const requestId = (execution, operation, account = '', index = 0) => {
  const h = createHash('sha256')
    .update(JSON.stringify(['emr-m05-website', execution, operation, account, index]))
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/** Injected fixed ports only. No credentials, direct SQL or implicit retry.
 * The caller's native ports enforce their own dev authorization and provider
 * allowance. This function never grants paid access or substitutes a lost start.
 */
export async function runWebsiteCollector(input, deps) {
  const methods = [
    'start',
    'claim',
    'diff',
    'cost',
    'launch',
    'register',
    'close_registration',
    'report',
    'finish',
  ];
  if (
    !object(input) ||
    Object.keys(input).some(
      (k) =>
        ![
          'env',
          'mode',
          'limit',
          'executionId',
          'account_ids',
          'max_actor_starts',
          'source_options',
        ].includes(k),
    ) ||
    input.env !== 'dev' ||
    !['daily', 'backfill'].includes(input.mode) ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 10 ||
    typeof input.executionId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(input.executionId) ||
    !Number.isSafeInteger(input.max_actor_starts) ||
    input.max_actor_starts < 1 ||
    input.max_actor_starts > 40 ||
    !object(input.account_ids) ||
    Object.keys(input.account_ids).sort().join(',') !== 'website,website_work_page' ||
    !object(deps) ||
    typeof deps.map !== 'function' ||
    typeof deps.startActor !== 'function' ||
    typeof deps.now !== 'function' ||
    !object(deps.gateway) ||
    methods.some((k) => typeof deps.gateway[k] !== 'function') ||
    !Number.isFinite(deps.firecrawlCreditUsd) ||
    deps.firecrawlCreditUsd <= 0 ||
    deps.firecrawlCreditUsd > 1
  )
    throw Error('website_invalid_run_input');
  const partitions = ['website_work_page', 'website'];
  const sourceOptions = websiteSourceOptions(input.source_options, input.mode);
  for (const platform of partitions)
    if (
      !Array.isArray(input.account_ids[platform]) ||
      input.account_ids[platform].some((id) => !uuid.test(id))
    )
      throw Error('website_invalid_run_input');
  const selected = partitions.flatMap((platform) => input.account_ids[platform]);
  if (!selected.length || selected.length > input.limit || new Set(selected).size !== selected.length)
    throw Error('website_invalid_run_input');
  const now = deps.now();
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now))) throw Error('website_invalid_run_input');
  const gateway = deps.gateway,
    accounts = [],
    outcomes = [],
    launched = [],
    plans = [],
    coverageRecords = [];
  let runId = null,
    stage = 'start',
    mapRequests = 0;
  const call = (name, args, account = '', index = 0) =>
    gateway[name](args, requestId(input.executionId, name, account, index));
  const report = async (account, status, error, seen = 0) => {
    stage = 'report';
    await call(
      'report',
      {
        run_id: runId,
        account_id: account.account_id,
        status,
        error,
        items_seen: seen,
        items_new: 0,
        backfill_done: false,
        backfill_cursor: account.backfill_cursor ?? null,
      },
      account.account_id,
    );
    outcomes.push({ account_id: account.account_id, status, error, items_new: 0 });
  };
  try {
    const started = await call('start', {
      workflow: 'WF-21',
      platform: 'website_work_page',
      mode: input.mode,
      env: 'dev',
      execution_id: input.executionId,
    });
    if (!object(started) || !uuid.test(started.run_id ?? '')) throw Error('invalid_receipt');
    runId = started.run_id;
    stage = 'claim';
    for (const platform of partitions) {
      const ids = input.account_ids[platform];
      if (!ids.length) continue;
      const claimed = await call(
        'claim',
        { platform, mode: input.mode, run_id: runId, limit: ids.length, account_ids: ids },
        platform,
      );
      if (
        !Array.isArray(claimed) ||
        claimed.length > ids.length ||
        new Set(claimed.map((a) => a.account_id)).size !== claimed.length ||
        claimed.some(
          (a) =>
            !object(a) ||
            !ids.includes(a.account_id) ||
            !uuid.test(a.competitor_id ?? '') ||
            (a.platform !== undefined && a.platform !== platform),
        )
      )
        throw Error('invalid_receipt');
      for (const entry of claimed) {
        const account = { ...entry, platform };
        website.websiteAccountScope(account);
        accounts.push(account);
      }
    }
    for (const account of accounts) {
      stage = 'map';
      const request = buildWebsiteMapRequest(account, { mode: input.mode, ...sourceOptions });
      mapRequests++;
      // A lost paid map response is reconciled, never automatically requested again.
      const response = await deps.map(request, { run_id: runId, account_id: account.account_id });
      if (!object(response) || !Number.isSafeInteger(response.statusCode)) throw Error('map_outcome_unknown');
      stage = 'cost';
      await call(
        'cost',
        {
          entries: [
            {
              provider: 'firecrawl',
              category: 'scrape',
              quantity: 1,
              unit: 'credit',
              cost_usd: deps.firecrawlCreditUsd,
              run_id: runId,
              competitor_id: account.competitor_id,
              platform: 'website_work_page',
              meta: {
                actor: 'firecrawl-map',
                account_id: account.account_id,
                cost_key: `firecrawl:${runId}:${account.account_id}`,
              },
            },
          ],
        },
        account.account_id,
      );
      let mapped;
      try {
        mapped = parseWebsiteMapResponse(response, account, { mode: input.mode, ...sourceOptions });
      } catch {
        await report(account, 'failed', 'web_map_contract_failed');
        continue;
      }
      if (
        mapped.emptyMap ||
        !mapped.urls.length ||
        (mapped.mapCapped && sourceOptions.max_new_urls_per_account === undefined)
      ) {
        await report(
          account,
          'failed',
          mapped.mapCapped
            ? 'web_map_limit_reached'
            : mapped.emptyMap
              ? 'web_map_empty'
              : 'web_map_no_project_evidence',
        );
        continue;
      }
      stage = 'diff';
      const fresh = new Set();
      for (let offset = 0; offset < mapped.urls.length; offset += 1000) {
        const urls = mapped.urls.slice(offset, offset + 1000);
        const result = await call(
          'diff',
          { run_id: runId, account_id: account.account_id, urls },
          account.account_id,
          offset,
        );
        const pending = Array.isArray(result) ? result : result?.urls;
        if (!Array.isArray(pending) || pending.some((url) => typeof url !== 'string' || !urls.includes(url)))
          throw Error('invalid_receipt');
        pending.forEach((url) => fresh.add(url));
      }
      const selection = selectWebsitePending(mapped.urls, [...fresh], sourceOptions);
      coverageRecords.push({ account_id: account.account_id, ...selection, map_capped: mapped.mapCapped });
      if (input.mode === 'daily' && fresh.size > 30 && fresh.size / mapped.urls.length > 0.8) {
        await report(account, 'failed', 'web_redesign_guard', mapped.urls.length);
        continue;
      }
      if (!selection.urls.length) {
        await report(account, 'success', null, mapped.urls.length);
        continue;
      }
      const crawler = account.backfill_cursor?.crawler ?? 'cheerio';
      const accountPlans = buildWebsiteCrawlerBatches(account, selection.urls, { crawlerType: crawler });
      plans.push(...accountPlans.map((plan) => ({ ...plan, account })));
    }
    if (plans.length > input.max_actor_starts) {
      stage = 'actor_allowance';
      throw Error('website_actor_bound_exceeded');
    }
    for (const [index, plan] of plans.entries()) {
      const launchId = requestId(input.executionId, 'actor_launch', plan.account.account_id, index);
      stage = 'launch';
      const admitted = await call(
        'launch',
        {
          run_id: runId,
          launch_id: launchId,
          actor_id: plan.actor,
          pass: 'primary',
          account_ids: plan.account_ids,
          purpose: input.mode,
          results_limit: plan.urls.length,
          urls: plan.urls,
          crawler_type: plan.crawler_type,
          actor_input: plan.input,
        },
        plan.account.account_id,
        index,
      );
      const permit = object(admitted?.result)
        ? { ...admitted.result, replayed: admitted.replayed }
        : admitted;
      if (
        !object(permit) ||
        permit.replayed !== false ||
        permit.permit !== true ||
        permit.launch_id !== launchId ||
        !object(permit.descriptor) ||
        permit.descriptor.billingModel !== 'PPU' ||
        permit.descriptor.actorPath !== 'apify~website-content-crawler' ||
        !/^[A-Za-z0-9._-]{1,128}$/.test(permit.descriptor.build ?? '') ||
        permit.descriptor.memory !== 1024 ||
        permit.descriptor.timeout !== 600 ||
        permit.descriptor.maxItems !== plan.urls.length ||
        !Number.isFinite(permit.descriptor.maxTotalChargeUsd) ||
        permit.descriptor.maxTotalChargeUsd <= 0 ||
        permit.descriptor.maxTotalChargeUsd > 0.4
      )
        throw Error('invalid_permit');
      stage = 'actor_start';
      const response = await deps.startActor(
        {
          ...plan,
          start_options: {
            waitForFinish: 0,
            restartOnError: false,
            timeout: permit.descriptor.timeout,
            memory: permit.descriptor.memory,
            build: permit.descriptor.build,
            maxTotalChargeUsd: permit.descriptor.maxTotalChargeUsd,
          },
        },
        permit.descriptor,
      );
      const actor = response?.body?.data ?? response?.data ?? response;
      if (
        (response?.statusCode !== undefined && ![200, 201].includes(response.statusCode)) ||
        !object(actor) ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(actor.id ?? '') ||
        launched.some((a) => a.apify_run_id === actor.id)
      )
        throw Error('actor_start_unknown');
      const capAcknowledged =
        object(actor.options) &&
        actor.options.maxTotalChargeUsd === permit.descriptor.maxTotalChargeUsd &&
        actor.options.isMaxTotalChargeUsdSetByUser === true;
      launched.push({
        launch_id: launchId,
        apify_run_id: actor.id,
        account_id: plan.account.account_id,
        cap_acknowledged: capAcknowledged,
      });
      stage = 'register';
      const registered = await call(
        'register',
        {
          run_id: runId,
          launch_id: launchId,
          apify_run_id: actor.id,
          actor_id: plan.actor,
          pass: 'primary',
          account_ids: plan.account_ids,
          purpose: input.mode,
        },
        plan.account.account_id,
        index,
      );
      if (
        !object(registered) ||
        registered.registered !== true ||
        registered.run_id !== runId ||
        registered.apify_run_id !== actor.id
      )
        throw Error('invalid_receipt');
      // The exact returned ID is durably registered before stopping. Retention
      // may be disabled in n8n; an in-memory ID alone is not a recovery record.
      if (!capAcknowledged) {
        stage = 'actor_cap_ack';
        throw Error('actor_cap_unverified');
      }
    }
    stage = 'close_registration';
    const closed = await call('close_registration', { run_id: runId });
    if (
      !object(closed) ||
      closed.registration_closed !== true ||
      typeof closed.finished_now !== 'boolean' ||
      !['completed', 'awaiting_callbacks'].includes(closed.state)
    )
      throw Error('invalid_receipt');
    if (closed.state === 'awaiting_callbacks') {
      if (closed.finished_now || closed.summary !== null) throw Error('invalid_receipt');
      return {
        state: 'awaiting_callbacks',
        run_id: runId,
        map_requests: mapRequests,
        actor_starts: launched.length,
        launches: launched,
        accounts: outcomes,
        coverage:
          sourceOptions.max_new_urls_per_account === undefined ? 'observed_map_only' : 'candidate_subset',
        coverage_records: coverageRecords,
      };
    }
    if (
      !closed.finished_now ||
      !object(closed.summary) ||
      closed.summary.run_id !== runId ||
      !['success', 'partial', 'failed'].includes(closed.summary.status)
    )
      throw Error('invalid_receipt');
    return {
      state: 'completed',
      run_id: runId,
      status: closed.summary.status,
      map_requests: mapRequests,
      actor_starts: launched.length,
      launches: launched,
      accounts: outcomes,
      coverage:
        sourceOptions.max_new_urls_per_account === undefined ? 'observed_map_only' : 'candidate_subset',
      coverage_records: coverageRecords,
      unclaimed_account_ids: selected.filter((id) => !accounts.some((a) => a.account_id === id)),
    };
  } catch {
    return {
      state: 'reconciliation_required',
      run_id: runId,
      stage,
      map_requests: mapRequests,
      actor_starts: launched.length,
      launches: launched,
      accounts: outcomes,
      coverage_records: coverageRecords,
    };
  }
}
