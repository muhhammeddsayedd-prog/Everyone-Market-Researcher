// Serializable WF-21 transitions. No network, imports, credentials or URL global.
// The native lexical URL subset is deliberately stricter than the Node URL
// normalizer (for example, literal dot segments are refused). Their identities
// must match for every accepted URL; requested-path case is never changed.
import { m05Gateway, m05RequestId } from './native-m05-runtime.mjs';
import {
  websiteMapBody,
  websiteMapLimit,
  websiteSourceOptions,
  selectWebsitePending,
  buildWebsiteCrawlerBatches,
  parseWebsiteMapResponse,
} from './website.mjs';
export function m05WebsiteCanonical(value) {
  const bad = () => {
    throw Error('M05_WEBSITE_URL_INVALID');
  };
  if (
    typeof value !== 'string' ||
    value.length > 8192 ||
    /[\s\u0000-\u001f\u007f\\]/u.test(value) ||
    /%(?:2f|5c|2e)/i.test(value)
  )
    return bad();
  const m = /^https:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i.exec(value);
  if (!m || m[1].includes('@')) return bad();
  const host = m[1].toLowerCase().replace(/:443$/, '');
  const labels = host.split('.'),
    suffix = labels.at(-1);
  if (
    labels.length < 2 ||
    host.includes(':') ||
    /^[\d.]+$/.test(host) ||
    [
      'arpa',
      'example',
      'home',
      'internal',
      'invalid',
      'lan',
      'local',
      'localdomain',
      'localhost',
      'onion',
      'test',
    ].includes(suffix) ||
    !/^[a-z][a-z\d-]*$/i.test(suffix) ||
    labels.some((v) => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(v))
  )
    return bad();
  for (const parameter of (m[3] ?? '').split('&')) {
    let key = parameter.split('=')[0].replaceAll('+', ' ');
    try {
      key = decodeURIComponent(key);
      for (let p = 0; p < 2 && key.includes('%'); p++) key = decodeURIComponent(key);
    } catch {
      return bad();
    }
    if (
      key.includes('%') ||
      [
        'accesstoken',
        'refreshtoken',
        'idtoken',
        'apikey',
        'clientsecret',
        'clientpassword',
        'accesskey',
        'password',
        'passwd',
        'pwd',
        'secret',
        'token',
        'auth',
        'authorization',
        'credential',
        'credentials',
        'signature',
        'sig',
        'key',
        'xgoogapikey',
        'xamzcredential',
        'xamzsignature',
        'xamzsecuritytoken',
      ].includes(key.toLowerCase().replace(/[-_]/g, ''))
    )
      return bad();
  }
  let path = m[2] || '/';
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(path) || /[<>"`{}]/.test(path) || /%(?![a-f\d]{2})/i.test(path))
    return bad();
  try {
    path = path.replace(/[^\u0021-\u007e]/gu, (character) => encodeURIComponent(character));
  } catch {
    return bad();
  }
  return 'https://' + host + (path === '/' ? '/' : path.replace(/\/+$/, ''));
}
export function m05WebsiteScope(account) {
  const uuid = (v) =>
    typeof v === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);
  if (
    !account ||
    typeof account !== 'object' ||
    !uuid(account.account_id ?? account.id) ||
    !uuid(account.competitor_id) ||
    !['website', 'website_work_page'].includes(account.platform)
  )
    throw Error('M05_WEBSITE_ACCOUNT_INVALID');
  const url = m05WebsiteCanonical(account.url),
    parts = /^(https:\/\/[^/]+)(\/.*)$/.exec(url);
  return {
    id: account.account_id ?? account.id,
    competitor_id: account.competitor_id,
    platform: account.platform,
    url,
    origin: parts[1],
    pathname: parts[2],
  };
}
export function m05WebsiteOwns(value, account) {
  const s = m05WebsiteScope(account),
    url = m05WebsiteCanonical(value),
    parts = /^(https:\/\/[^/]+)(\/.*)$/.exec(url);
  return (
    parts[1] === s.origin &&
    (s.platform === 'website' ||
      s.pathname === '/' ||
      parts[2] === s.pathname ||
      parts[2].startsWith(s.pathname + '/'))
  );
}
export function m05WebsiteProject(value, account) {
  const s = m05WebsiteScope(account),
    url = m05WebsiteCanonical(value),
    path = url.slice(/^https:\/\/[^/]+/.exec(url)[0].length);
  if (
    !m05WebsiteOwns(url, account) ||
    /(?:^|\/)(?:tag|tags|category|categories|page|wp-json|feed|privacy|terms|contact|careers|about|team|cookie|404)(?:\/|$)/i.test(
      path,
    ) ||
    /\.(?:jpe?g|png|gif|webp|svg|ico|pdf|docx?|xlsx?|pptx?|zip|mp[34]|mov|avi|wav|woff2?|css|js|json|xml)(?:$|\/)/i.test(
      path,
    )
  )
    return false;
  if (s.platform === 'website_work_page' && s.pathname !== '/') return path !== s.pathname;
  return /(?:^|\/)(?:work|works|projects?[^/]*|portfolio|case-stud[^/]*|films|campaigns|clients|news|blog)(?:\/)[^/]+/i.test(
    path,
  );
}
export function initializeM05Website(input, executionId, now) {
  const uuid = (v) =>
    typeof v === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(input).some(
      (k) =>
        ![
          'account_ids',
          'env',
          'firecrawl_credit_usd',
          'max_actor_starts',
          'mode',
          'source_options',
        ].includes(k),
    ) ||
    input.env !== 'dev' ||
    !['daily', 'backfill'].includes(input.mode) ||
    !input.account_ids ||
    Object.keys(input.account_ids).sort().join(',') !== 'website,website_work_page' ||
    !Number.isInteger(input.max_actor_starts) ||
    input.max_actor_starts < 1 ||
    input.max_actor_starts > 2147483647 ||
    !Number.isFinite(input.firecrawl_credit_usd) ||
    input.firecrawl_credit_usd <= 0 ||
    input.firecrawl_credit_usd > 1 ||
    typeof now !== 'string' ||
    !Number.isFinite(Date.parse(now))
  )
    throw Error('M05_WEBSITE_SELECTION_INVALID');
  const partitions = ['website_work_page', 'website'];
  if (
    partitions.some(
      (p) => !Array.isArray(input.account_ids[p]) || input.account_ids[p].some((id) => !uuid(id)),
    )
  )
    throw Error('M05_WEBSITE_SELECTION_INVALID');
  const ids = partitions.flatMap((p) => input.account_ids[p]);
  if (ids.length < 1 || ids.length > 10 || new Set(ids).size !== ids.length)
    throw Error('M05_WEBSITE_SELECTION_INVALID');
  const state = {
    executionId,
    now,
    mode: input.mode,
    selected: input.account_ids,
    creditUsd: input.firecrawl_credit_usd,
    maxActors: input.max_actor_starts,
    sourceOptions: websiteSourceOptions(input.source_options, input.mode),
    sequence: 0,
    accounts: [],
    claimIndex: 0,
    accountIndex: 0,
    outcomes: [],
    plans: [],
    planIndex: 0,
    launches: [],
    mapRequests: 0,
    actorStarts: 0,
    coverageRecords: [],
  };
  return m05Gateway(state, 'start', {
    workflow: 'WF-21',
    platform: 'website_work_page',
    mode: state.mode,
    env: 'dev',
    execution_id: executionId,
  });
}
export function m05WebsiteEnd(state, result) {
  state.action = 'done';
  state.result = {
    ...result,
    run_id: state.runId ?? null,
    map_requests: state.mapRequests,
    actor_starts: state.actorStarts,
    launches: state.launches,
    accounts: state.outcomes,
    coverage:
      state.sourceOptions.max_new_urls_per_account === undefined ? 'observed_map_only' : 'candidate_subset',
    coverage_records: state.coverageRecords,
    cost_basis: 'trusted_price_book_map_attempts_not_provider_billing_receipt',
  };
  return state;
}
export function m05WebsiteClosed(state, result, allowPending) {
  if (
    !result ||
    typeof result !== 'object' ||
    result.registration_closed !== true ||
    typeof result.finished_now !== 'boolean'
  )
    throw Error('M05_RECEIPT_INVALID');
  if (allowPending && result.state === 'awaiting_callbacks') {
    if (result.finished_now || result.summary !== null) throw Error('M05_RECEIPT_INVALID');
    return m05WebsiteEnd(state, { state: 'awaiting_callbacks' });
  }
  if (
    result.state !== 'completed' ||
    result.finished_now !== true ||
    !result.summary ||
    typeof result.summary !== 'object' ||
    result.summary.run_id !== state.runId ||
    !['success', 'partial', 'failed'].includes(result.summary.status)
  )
    throw Error('M05_RECEIPT_INVALID');
  return m05WebsiteEnd(state, { state: 'completed', status: result.summary.status });
}
export function m05WebsiteClaim(state) {
  const partitions = ['website_work_page', 'website'];
  while (state.claimIndex < partitions.length) {
    const platform = partitions[state.claimIndex++],
      ids = state.selected[platform];
    if (ids.length)
      return m05Gateway(state, 'claim', {
        run_id: state.runId,
        platform,
        mode: state.mode,
        limit: ids.length,
        account_ids: ids,
      });
  }
  return m05WebsiteAccount(state);
}
export function m05WebsiteAccount(state) {
  const account = state.accounts[state.accountIndex];
  if (!account) {
    state.planIndex = 0;
    return m05WebsiteLaunch(state);
  }
  state.current = { account };
  state.mapRequests++;
  state.action = 'map';
  state.http = {
    body: websiteMapBody(
      m05WebsiteScope(account).url,
      websiteMapLimit({ mode: state.mode, ...state.sourceOptions }),
    ),
  };
  return state;
}
export function m05WebsiteReport(state, status, error, seen = 0) {
  return m05Gateway(state, 'report', {
    run_id: state.runId,
    account_id: state.current.account.account_id,
    status,
    error,
    items_seen: seen,
    items_new: 0,
    backfill_done: false,
    backfill_cursor: state.current.account.backfill_cursor ?? null,
  });
}
export function m05WebsiteDiff(state) {
  const c = state.current;
  if (c.offset < c.mapped.urls.length) {
    c.diffUrls = c.mapped.urls.slice(c.offset, c.offset + 1000);
    return m05Gateway(state, 'diff', {
      run_id: state.runId,
      account_id: c.account.account_id,
      urls: c.diffUrls,
    });
  }
  const selection = selectWebsitePending(c.mapped.urls, c.fresh, state.sourceOptions);
  state.coverageRecords.push({
    account_id: c.account.account_id,
    ...selection,
    map_capped: c.mapped.mapCapped,
  });
  if (state.mode === 'daily' && c.fresh.length > 30 && c.fresh.length / c.mapped.urls.length > 0.8)
    return m05WebsiteReport(state, 'failed', 'web_redesign_guard', c.mapped.urls.length);
  if (!selection.urls.length) return m05WebsiteReport(state, 'success', null, c.mapped.urls.length);
  let plans;
  try {
    plans = buildWebsiteCrawlerBatches(c.account, selection.urls, {
      crawlerType: c.account.backfill_cursor?.crawler ?? 'cheerio',
    });
  } catch {
    return m05WebsiteReport(state, 'failed', 'web_crawler_cursor_invalid', c.mapped.urls.length);
  }
  state.plans.push(...plans.map((p) => ({ ...p, account: c.account })));
  state.accountIndex++;
  return m05WebsiteAccount(state);
}
export function m05WebsiteMapParsed(state) {
  const c = state.current;
  try {
    c.mapped = parseWebsiteMapResponse(c.response, c.account, { mode: state.mode, ...state.sourceOptions });
  } catch {
    return m05WebsiteReport(state, 'failed', 'web_map_contract_failed');
  }
  delete c.response;
  if (
    c.mapped.emptyMap ||
    !c.mapped.urls.length ||
    (c.mapped.mapCapped && state.sourceOptions.max_new_urls_per_account === undefined)
  )
    return m05WebsiteReport(
      state,
      'failed',
      c.mapped.mapCapped
        ? 'web_map_limit_reached'
        : c.mapped.emptyMap
          ? 'web_map_empty'
          : 'web_map_no_project_evidence',
    );
  c.offset = 0;
  c.fresh = [];
  return m05WebsiteDiff(state);
}
export function m05WebsiteLaunch(state) {
  if (state.plans.length > state.maxActors)
    return m05WebsiteEnd(state, { state: 'reconciliation_required', stage: 'actor_allowance' });
  const plan = state.plans[state.planIndex];
  if (!plan) return m05Gateway(state, 'close_registration', { run_id: state.runId });
  state.launchId = m05RequestId(state.executionId, state.sequence + 1);
  return m05Gateway(state, 'launch', {
    run_id: state.runId,
    launch_id: state.launchId,
    actor_id: plan.actor,
    pass: 'primary',
    account_ids: plan.account_ids,
    purpose: state.mode,
    results_limit: plan.urls.length,
    urls: plan.urls,
    crawler_type: plan.crawler_type,
    actor_input: plan.input,
  });
}
export function advanceM05WebsiteGateway(state, response) {
  const receipt = response?.body;
  if (
    response?.statusCode !== 200 ||
    receipt?.version !== 1 ||
    receipt.requestId !== state.request.requestId ||
    receipt.operation !== state.request.operation ||
    typeof receipt.replayed !== 'boolean' ||
    !Object.hasOwn(receipt, 'result')
  )
    throw Error('M05_GATEWAY_RECONCILIATION_REQUIRED');
  const result = receipt.result,
    op = state.request.operation;
  if (op === 'm05.start') {
    if (
      typeof result?.run_id !== 'string' ||
      !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(result.run_id)
    )
      throw Error('M05_RECEIPT_INVALID');
    state.runId = result.run_id;
    return m05WebsiteClaim(state);
  }
  if (op === 'm05.claim') {
    const a = state.request.args;
    if (
      !Array.isArray(result) ||
      result.length > a.account_ids.length ||
      new Set(result.map((r) => r.account_id)).size !== result.length ||
      result.some(
        (r) =>
          !r ||
          !a.account_ids.includes(r.account_id) ||
          (r.platform !== undefined && r.platform !== a.platform),
      )
    )
      throw Error('M05_RECEIPT_INVALID');
    for (const r of result) {
      const account = { ...r, platform: a.platform };
      m05WebsiteScope(account);
      state.accounts.push(account);
    }
    return m05WebsiteClaim(state);
  }
  if (op === 'm05.cost') return m05WebsiteMapParsed(state);
  if (op === 'm05.diff') {
    const c = state.current,
      pending = Array.isArray(result) ? result : result?.urls;
    if (
      !Array.isArray(pending) ||
      pending.some((url) => typeof url !== 'string' || !c.diffUrls.includes(url))
    )
      throw Error('M05_RECEIPT_INVALID');
    for (const url of pending) if (!c.fresh.includes(url)) c.fresh.push(url);
    c.offset += c.diffUrls.length;
    return m05WebsiteDiff(state);
  }
  if (op === 'm05.report') {
    const a = state.request.args;
    state.outcomes.push({
      account_id: a.account_id,
      status: a.status,
      error: a.error,
      items_new: 0,
      backfill_done: false,
    });
    state.accountIndex++;
    return m05WebsiteAccount(state);
  }
  if (op === 'm05.launch') {
    const d = result?.descriptor,
      plan = state.plans[state.planIndex];
    if (receipt.replayed || result?.permit !== true || result.launch_id !== state.launchId)
      throw Error('M05_ACTOR_LAUNCH_RECONCILIATION_REQUIRED');
    if (
      !d ||
      d.billingModel !== 'PPU' ||
      d.actorPath !== 'apify~website-content-crawler' ||
      !/^[A-Za-z\d._-]{1,128}$/.test(d.build ?? '') ||
      d.memory !== 1024 ||
      d.timeout !== 600 ||
      d.maxItems !== plan.urls.length ||
      !Number.isFinite(d.maxTotalChargeUsd) ||
      d.maxTotalChargeUsd <= 0
    )
      throw Error('M05_ACTOR_DESCRIPTOR_INVALID');
    state.actor = { descriptor: d, input: plan.input };
    state.action = 'apify';
    return state;
  }
  if (op === 'm05.register') {
    if (
      result?.registered !== true ||
      result.run_id !== state.runId ||
      result.apify_run_id !== state.startedActorId
    )
      throw Error('M05_RECEIPT_INVALID');
    if (state.actorCapAcknowledged !== true)
      return m05WebsiteEnd(state, { state: 'reconciliation_required', stage: 'actor_cap_ack' });
    state.planIndex++;
    return m05WebsiteLaunch(state);
  }
  if (op === 'm05.close_registration') {
    return m05WebsiteClosed(state, result, true);
  }
  if (op === 'm05.finish') return m05WebsiteClosed(state, result, false);
  throw Error('M05_OPERATION_INVALID');
}
export function advanceM05WebsiteMap(state, response) {
  if (!response || !Number.isInteger(response.statusCode))
    return m05WebsiteEnd(state, { state: 'reconciliation_required', stage: 'map_outcome_unknown' });
  state.current.response = response;
  const a = state.current.account;
  return m05Gateway(state, 'cost', {
    entries: [
      {
        provider: 'firecrawl',
        category: 'scrape',
        quantity: 1,
        unit: 'credit',
        cost_usd: state.creditUsd,
        run_id: state.runId,
        competitor_id: a.competitor_id,
        platform: 'website_work_page',
        meta: {
          actor: 'firecrawl-map',
          account_id: a.account_id,
          cost_key: 'firecrawl:' + state.runId + ':' + a.account_id,
        },
      },
    ],
  });
}
export function advanceM05WebsiteActor(state, response) {
  const actor = response?.body?.data;
  if (
    response?.statusCode !== 201 ||
    !actor ||
    typeof actor.id !== 'string' ||
    !/^[A-Za-z\d_-]{1,128}$/.test(actor.id ?? '') ||
    state.launches.some((l) => l.apify_run_id === actor.id)
  )
    return m05WebsiteEnd(state, { state: 'reconciliation_required', stage: 'actor_start' });
  const p = state.plans[state.planIndex];
  state.actorStarts++;
  state.startedActorId = actor.id;
  state.actorCapAcknowledged =
    actor.options !== null &&
    typeof actor.options === 'object' &&
    actor.options.maxTotalChargeUsd === state.actor.descriptor.maxTotalChargeUsd &&
    actor.options.isMaxTotalChargeUsdSetByUser === true;
  state.launches.push({
    launch_id: state.launchId,
    apify_run_id: actor.id,
    account_id: p.account.account_id,
    cap_acknowledged: state.actorCapAcknowledged,
  });
  return m05Gateway(state, 'register', {
    run_id: state.runId,
    launch_id: state.launchId,
    apify_run_id: actor.id,
    actor_id: p.actor,
    pass: 'primary',
    account_ids: p.account_ids,
    purpose: state.mode,
  });
}
