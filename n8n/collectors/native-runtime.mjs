// Collector-specific, serializable transitions for the supported native HTTP
// nodes. No I/O, credentials, URL global, package imports or general RPC tunnel.
export function collectorRequestId(executionId, sequence) {
  if (
    !/^\d{1,15}$/.test(executionId) ||
    !Number.isSafeInteger(Number(executionId)) ||
    Number(executionId) >= 2 ** 48 ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > 4095
  )
    throw Error('M04_EXECUTION_ID_INVALID');
  return `c04c0000-${sequence.toString(16).padStart(4, '0')}-4000-a000-${Number(executionId).toString(16).padStart(12, '0')}`;
}

export function collectorGateway(state, operation, args) {
  state.sequence += 1;
  state.action = 'gateway';
  state.request = {
    version: 1,
    requestId: collectorRequestId(state.executionId, state.sequence),
    operation,
    args,
  };
  return state;
}

export function initializeCollector(input, kind, executionId, now) {
  const bad = () => {
    throw Error('M04_COLLECTOR_INPUT_INVALID');
  };
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (k) =>
        ![
          'env',
          'mode',
          'limit',
          'result_type',
          'max_pages',
          'page_size',
          'results_limit',
          'max_actor_starts',
          'account_ids',
        ].includes(k),
    ) ||
    (input.env !== undefined && input.env !== null && input.env !== 'dev') ||
    !['vimeo', 'instagram'].includes(kind)
  )
    bad();
  const mode = input.mode ?? 'daily',
    limit = input.limit ?? 5;
  if (
    !['daily', 'backfill'].includes(mode) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > (kind === 'vimeo' ? 10 : 100) ||
    !Number.isFinite(Date.parse(now))
  )
    bad();
  // A caller cannot split posts/reels into independent primary claim owners.
  if (input.result_type !== undefined && input.result_type !== null && input.result_type !== 'both') bad();
  const maxPages = input.max_pages ?? (mode === 'daily' ? 3 : 50),
    pageSize = input.page_size ?? 100;
  const resultsLimit = input.results_limit ?? (mode === 'daily' ? 30 : 1500),
    maxActorStarts = input.max_actor_starts ?? 40;
  if (
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > (mode === 'daily' ? 3 : 50) ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    !Number.isInteger(resultsLimit) ||
    resultsLimit < 1 ||
    resultsLimit > (mode === 'daily' ? (kind === 'vimeo' ? 60 : 30) : 3000) ||
    !Number.isInteger(maxActorStarts) ||
    maxActorStarts < 1 ||
    maxActorStarts > 40
  )
    bad();
  if (
    !Array.isArray(input.account_ids) ||
    input.account_ids.length < 1 ||
    input.account_ids.length !== limit ||
    new Set(input.account_ids).size !== input.account_ids.length ||
    input.account_ids.some(
      (id) =>
        typeof id !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id),
    )
  )
    bad();
  collectorRequestId(executionId, 1);
  const state = {
    kind,
    executionId,
    now,
    mode,
    limit,
    maxPages,
    pageSize,
    resultsLimit,
    resultsLimitExplicit: input.results_limit !== undefined && input.results_limit !== null,
    maxActorStarts,
    accountIds: input.account_ids ?? undefined,
    sequence: 0,
    accounts: [],
    accountIndex: 0,
    outcomes: [],
    calls: 0,
    actorStarts: 0,
  };
  return collectorGateway(state, 'start', {
    workflow: kind === 'vimeo' ? 'WF-10' : 'WF-11',
    platform: kind,
    mode,
    env: 'dev',
    execution_id: executionId,
  });
}

export function collectorReceipt(state, response) {
  const b = response?.body;
  if (
    response?.statusCode !== 200 ||
    !b ||
    b.version !== 1 ||
    b.requestId !== state.request.requestId ||
    b.operation !== state.request.operation ||
    typeof b.replayed !== 'boolean' ||
    !Object.hasOwn(b, 'result')
  )
    throw Error('M04_GATEWAY_RECONCILIATION_REQUIRED');
  return b;
}

export function vimeoNativeAccount(state) {
  const account = state.accounts[state.accountIndex];
  if (!account && state.hasAsync)
    return collectorGateway(state, 'close_registration', { run_id: state.runId });
  if (!account)
    return collectorGateway(state, 'finish', {
      run_id: state.runId,
      status: state.outcomes.some((x) => x.status === 'failed')
        ? state.outcomes.some((x) => x.status === 'success')
          ? 'partial'
          : 'failed'
        : 'success',
      error: state.outcomes.some((x) => x.status === 'failed') ? 'collector_account_failed' : null,
    });
  const bad = () => {
    throw Error('M04_VIMEO_ACCOUNT_INVALID');
  };
  const match = /^https:\/\/(?:www\.)?vimeo\.com\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?\/?$/.exec(
    account.url ?? '',
  );
  if (
    !match ||
    !/^[a-f0-9-]{36}$/i.test(account.account_id) ||
    !/^[a-f0-9-]{36}$/i.test(account.competitor_id)
  )
    bad();
  let path,
    resolving = false,
    collection = false;
  if (['channels', 'groups'].includes(match[1]) && match[2]) {
    path = '/' + match[1] + '/' + match[2];
    collection = true;
  } else if (match[1] === 'showcase' && /^\d+$/.test(match[2] ?? '')) {
    path = account.backfill_cursor?.resourcePath;
    collection = true;
    if (
      path !== undefined &&
      (typeof path !== 'string' || !new RegExp('^/users/[0-9]+/albums/' + match[2] + '$').test(path))
    )
      bad();
  } else if (!match[2] && !/^\d+$/.test(match[1])) {
    if (account.external_id) {
      if (!/^\d+$/.test(account.external_id)) bad();
      path = '/users/' + account.external_id;
    } else {
      path = '/users/' + match[1];
      resolving = true;
    }
  } else bad();
  const floor = account.backfill_from ?? '2024-01-01';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(floor) ||
    new Date(floor + 'T00:00:00Z').toISOString().slice(0, 10) !== floor
  )
    bad();
  const watermark = account.watermark_published_at ?? account.last_item_published_at;
  if (watermark && !Number.isFinite(Date.parse(watermark))) bad();
  const cutoff =
    state.mode === 'daily' && watermark
      ? new Date(
          Math.max(
            Date.parse(floor),
            Math.min(Date.parse(watermark) - 86400000, Date.parse(state.now) - 30 * 86400000),
          ),
        ).toISOString()
      : floor + 'T00:00:00.000Z';
  const page = state.mode === 'backfill' ? (account.backfill_cursor?.page ?? 1) : 1;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    (state.mode === 'backfill' &&
      account.backfill_cursor?.resourcePath &&
      account.backfill_cursor.resourcePath !== path)
  )
    bad();
  state.current = {
    account,
    path,
    page,
    pages: 0,
    resolving,
    collection,
    items: [],
    calls: 0,
    cutoff,
    backfillDone: false,
    cursor: null,
    error: null,
    retries: 0,
    waitedMs: 0,
    oldest: null,
  };
  if (!path) return vimeoNativeFallback(state, 'vimeo_showcase_owner_required');
  return vimeoNativeRequest(state);
}

export function vimeoNativeFallback(state, reason) {
  const c = state.current;
  const actor = c.collection
    ? 'dltik/vimeo-scraper'
    : state.mode === 'daily'
      ? 'goat255/vimeo-scraper'
      : null;
  if (!actor) {
    c.error = reason + '_no_backfill_fallback';
    return vimeoNativeReport(state);
  }
  if (state.actorStarts >= state.maxActorStarts) throw Error('M04_ACTOR_ALLOWANCE_INSUFFICIENT');
  const resultsLimit =
    actor === 'goat255/vimeo-scraper'
      ? Math.min(state.resultsLimitExplicit ? state.resultsLimit : 20, 60)
      : Math.min(state.resultsLimit, state.mode === 'daily' ? 50 : 1000);
  const input =
    actor === 'goat255/vimeo-scraper'
      ? {
          videoUrls: [],
          users: [c.account.url],
          maxVideosPerUser: Math.min(resultsLimit, 60),
          includeProfile: false,
          concurrency: 1,
        }
      : { urls: [c.account.url], maxResults: resultsLimit };
  state.hasAsync = true;
  state.batches = [
    { actor, result_type: 'primary', account_ids: [c.account.account_id], input, resultsLimit },
  ];
  state.batchIndex = 0;
  c.fallbackReason = reason;
  return nextInstagramLaunch(state);
}

export function vimeoNativeRequest(state) {
  const c = state.current;
  if (c.cooldownSeconds) {
    state.action = 'wait';
    state.waitSeconds = c.cooldownSeconds;
    delete c.cooldownSeconds;
    return state;
  }
  const fields =
    'uri,link,name,description,release_time,created_time,duration,privacy.view,pictures.sizes,tags,stats.plays,metadata.connections.likes.total,metadata.connections.comments.total';
  state.action = 'vimeo';
  state.providerUrl = c.resolving
    ? 'https://api.vimeo.com' + c.path + '?fields=uri'
    : 'https://api.vimeo.com' +
      c.path +
      '/videos?sort=date&direction=desc&per_page=' +
      state.pageSize +
      '&page=' +
      c.page +
      '&fields=' +
      encodeURIComponent(fields);
  return state;
}

export function vimeoNativeReport(state) {
  const c = state.current;
  return collectorGateway(state, 'report', {
    run_id: state.runId,
    account_id: c.account.account_id,
    status: c.error ? 'failed' : 'success',
    items_seen: c.ingestedSeen ?? 0,
    items_new: c.inserted ?? 0,
    error: c.error,
    backfill_done: c.backfillDone,
    backfill_cursor: c.cursor,
  });
}

export function advanceVimeoNative(state, response, normalize) {
  const c = state.current;
  c.calls += 1;
  state.calls += 1;
  const headers = response?.headers ?? {},
    status = response?.statusCode;
  if (status === 429) {
    if (c.retries >= 3) {
      c.error = 'vimeo_rate_limit';
      return vimeoNativeReport(state);
    }
    const wait = Number(headers['retry-after'] ?? 60) * 1000;
    if (!Number.isFinite(wait) || wait < 1000 || wait > 600000 || c.waitedMs + wait > 600000) {
      c.error = 'vimeo_rate_limit';
      return vimeoNativeReport(state);
    }
    c.retries += 1;
    c.waitedMs += wait;
    state.waitSeconds = Math.ceil(wait / 1000);
    state.action = 'wait';
    return state;
  }
  if (status !== 200 || !response.body || typeof response.body !== 'object') {
    c.error = status === 401 || status === 403 ? 'vimeo_access_denied' : 'vimeo_http_failed';
    // Never use an actor to evade private/access denial or exhausted API quota.
    if (status === 404 || status === 405 || (Number.isInteger(status) && status >= 500))
      return vimeoNativeFallback(state, c.error);
    return vimeoNativeReport(state);
  }
  const remainingKey = Object.keys(headers).find((k) => k.toLowerCase() === 'x-ratelimit-remaining');
  const remaining = remainingKey === undefined ? null : Number(headers[remainingKey]);
  if (remaining !== null && (!Number.isFinite(remaining) || remaining < 0)) {
    c.error = 'vimeo_rate_limit';
    return vimeoNativeReport(state);
  }
  if (remaining !== null && remaining < 10) {
    const resetKey = Object.keys(headers).find((k) => k.toLowerCase() === 'x-ratelimit-reset');
    const reset = resetKey === undefined ? NaN : Date.parse(headers[resetKey]);
    const wait = Math.max(0, reset - Date.parse(state.now) - c.waitedMs);
    if (!Number.isFinite(wait) || wait > 600000 || c.waitedMs + wait > 600000) {
      c.error = 'vimeo_rate_limit';
      return vimeoNativeReport(state);
    }
    if (wait) {
      c.waitedMs += wait;
      c.cooldownSeconds = Math.ceil(wait / 1000);
    }
  }
  c.retries = 0;
  if (c.resolving) {
    const id = /^\/users\/(\d+)$/.exec(response.body.uri ?? '')?.[1];
    if (!id) {
      c.error = 'vimeo_resolution_failed';
      return collectorGateway(state, 'resolve', {
        account_id: c.account.account_id,
        external_id: null,
        uploads_playlist_id: null,
      });
    }
    c.path = '/users/' + id;
    c.resolving = false;
    return collectorGateway(state, 'resolve', {
      account_id: c.account.account_id,
      external_id: id,
      uploads_playlist_id: null,
    });
  }
  const rows = response.body.data;
  if (
    !Array.isArray(rows) ||
    rows.length > state.pageSize ||
    !response.body.paging ||
    !Object.hasOwn(response.body.paging, 'next')
  ) {
    c.error = 'vimeo_contract_drift';
    return vimeoNativeReport(state);
  }
  let normalized;
  try {
    normalized = normalize(rows, { account: c.account, cutoff: c.cutoff, metricsCutoff: c.cutoff });
  } catch {
    c.error = 'vimeo_contract_drift';
    return vimeoNativeReport(state);
  }
  if (normalized.errors.length) {
    c.error = 'vimeo_contract_drift';
    return vimeoNativeReport(state);
  }
  for (const row of rows) {
    const date = row.release_time ?? row.created_time;
    if (!Number.isFinite(Date.parse(date)) || (c.oldest && Date.parse(date) > Date.parse(c.oldest))) {
      c.error = 'vimeo_ordering_unverified';
      return vimeoNativeReport(state);
    }
    c.oldest = date;
  }
  c.items.push(...normalized.items);
  c.pages += 1;
  const next = response.body.paging.next;
  let nextPage = null;
  if (next !== null) {
    // Only a same-resource, immediately following page may affect the loop.
    const raw = typeof next === 'string' ? next.replace(/^https:\/\/api\.vimeo\.com/, '') : '';
    const parts = raw.split('?');
    const params = parts[1]?.split('&').map((x) => x.split('=')) ?? [];
    const seen = new Set();
    if (
      parts.length !== 2 ||
      parts[0] !== c.path + '/videos' ||
      params.some(
        ([k, v]) =>
          !['page', 'per_page', 'sort', 'direction', 'fields'].includes(k) ||
          seen.has(k) ||
          (seen.add(k), v === undefined),
      ) ||
      !params.some(([k, v]) => k === 'page' && /^\d+$/.test(v) && Number(v) === c.page + 1) ||
      params.some(([k, v]) => k === 'per_page' && Number(v) !== state.pageSize)
    ) {
      c.error = 'vimeo_pagination_invalid';
      return vimeoNativeReport(state);
    }
    nextPage = c.page + 1;
  }
  const exhausted = nextPage === null || (c.oldest && Date.parse(c.oldest) < Date.parse(c.cutoff));
  if (exhausted || c.pages >= state.maxPages) {
    c.backfillDone = state.mode === 'backfill' && Boolean(exhausted);
    c.cursor =
      state.mode === 'backfill' && !exhausted
        ? { endpoint: c.path.split('/')[1], resourcePath: c.path, page: nextPage }
        : null;
    c.chunks = [];
    let chunk = [],
      bytes = 2;
    for (const item of c.items) {
      let itemBytes = 0;
      for (const character of JSON.stringify(item)) {
        const p = character.codePointAt(0);
        itemBytes += p <= 127 ? 1 : p <= 2047 ? 2 : p <= 65535 ? 3 : 4;
      }
      // Reserve4096 bytes for the closed gateway envelope and UUID arguments.
      if (itemBytes > 512 * 1024 - 4096) {
        c.error = 'vimeo_item_transport_bound';
        return vimeoNativeReport(state);
      }
      if (chunk.length && (chunk.length >= 500 || bytes + itemBytes + 1 > 512 * 1024 - 4096)) {
        c.chunks.push(chunk);
        chunk = [];
        bytes = 2;
      }
      chunk.push(item);
      bytes += itemBytes + 1;
    }
    if (chunk.length) c.chunks.push(chunk);
    c.inserted = 0;
    return c.chunks.length
      ? collectorGateway(state, 'ingest', {
          run_id: state.runId,
          account_id: c.account.account_id,
          items: c.chunks[0],
        })
      : vimeoNativeReport(state);
  }
  c.page = nextPage;
  return vimeoNativeRequest(state);
}

export function advanceCollectorGateway(state, response, planInstagram) {
  const receipt = collectorReceipt(state, response),
    result = receipt.result,
    op = state.request.operation;
  const bad = () => {
    throw Error('M04_GATEWAY_RECONCILIATION_REQUIRED');
  };
  if (op === 'start') {
    if (!/^[a-f0-9-]{36}$/i.test(result?.run_id)) bad();
    state.runId = result.run_id;
    return collectorGateway(state, 'claim', {
      run_id: state.runId,
      platform: state.kind,
      mode: state.mode,
      limit: state.limit,
      ...(state.accountIds ? { account_ids: state.accountIds } : {}),
    });
  }
  if (op === 'claim') {
    if (
      !Array.isArray(result) ||
      result.length > state.limit ||
      new Set(result.map((a) => a.account_id)).size !== result.length
    )
      bad();
    state.accounts = result;
    if (state.kind === 'vimeo') return vimeoNativeAccount(state);
    const accounts = result.map((a) => ({
      ...a,
      id: a.account_id,
      last_item_published_at: a.watermark_published_at ?? a.last_item_published_at,
    }));
    state.batches = ['posts', 'reels']
      .flatMap((result_type) => planInstagram(accounts, { mode: state.mode, result_type }))
      .map((batch, index) => ({
        ...batch,
        index,
        resultsLimit: state.resultsLimitExplicit ? state.resultsLimit : batch.input.resultsLimit,
        input: {
          ...batch.input,
          resultsLimit: state.resultsLimitExplicit ? state.resultsLimit : batch.input.resultsLimit,
        },
      }));
    if (state.batches.length > state.maxActorStarts) throw Error('M04_ACTOR_ALLOWANCE_INSUFFICIENT');
    state.batchIndex = 0;
    return nextInstagramLaunch(state);
  }
  if (op === 'resolve') {
    if (result?.ok !== true) bad();
    return state.current.error ? vimeoNativeReport(state) : vimeoNativeRequest(state);
  }
  if (op === 'ingest') {
    const c = state.current,
      batch = c.chunks.shift();
    if (
      !Number.isSafeInteger(result?.inserted) ||
      result.inserted < 0 ||
      !Number.isSafeInteger(result?.duplicates) ||
      result.duplicates < 0 ||
      result.inserted + result.duplicates > batch.length
    )
      bad();
    c.inserted += result.inserted;
    c.ingestedSeen = (c.ingestedSeen ?? 0) + batch.length;
    return c.chunks.length
      ? collectorGateway(state, 'ingest', {
          run_id: state.runId,
          account_id: c.account.account_id,
          items: c.chunks[0],
        })
      : vimeoNativeReport(state);
  }
  if (op === 'report') {
    if (result?.ok !== true) bad();
    const c = state.current;
    return collectorGateway(state, 'cost', {
      entries: [
        {
          provider: 'vimeo',
          category: 'scrape',
          quantity: c.calls,
          unit: 'call',
          cost_usd: 0,
          run_id: state.runId,
          competitor_id: c.account.competitor_id,
          platform: 'vimeo',
          meta: {
            actor: 'vimeo-api',
            account_id: c.account.account_id,
            cost_key: 'vimeo:' + state.runId + ':' + c.account.account_id,
          },
        },
      ],
    });
  }
  if (op === 'cost') {
    if (!Number.isSafeInteger(result?.inserted) || result.inserted < 0) bad();
    state.outcomes.push({
      account_id: state.current.account.account_id,
      status:
        state.afterCost === 'fallback' ? 'awaiting_callback' : state.current.error ? 'failed' : 'success',
      inserted: state.current.inserted ?? 0,
      calls: state.current.calls,
    });
    delete state.afterCost;
    state.accountIndex += 1;
    return vimeoNativeAccount(state);
  }
  if (op === 'finish') {
    state.action = 'done';
    state.summary = result;
    return state;
  }
  if (op === 'launch') {
    if (receipt.replayed || result?.permit !== true || result.launch_id !== state.launchId)
      throw Error('M04_ACTOR_LAUNCH_RECONCILIATION_REQUIRED');
    const d = result.descriptor;
    if (
      !d ||
      d.actorPath !== state.batches[state.batchIndex].actor.replace('/', '~') ||
      !/^[a-zA-Z0-9._-]{1,128}$/.test(d.build ?? '') ||
      !Number.isFinite(d.maxTotalChargeUsd) ||
      d.maxTotalChargeUsd <= 0 ||
      d.maxTotalChargeUsd > 10 ||
      !Number.isSafeInteger(d.maxItems) ||
      d.maxItems < 1 ||
      d.maxItems >
        state.batches[state.batchIndex].account_ids.length *
          (state.batches[state.batchIndex].resultsLimit ?? state.resultsLimit) ||
      !Number.isInteger(d.timeout) ||
      d.timeout < 60 ||
      d.timeout > 900 ||
      d.memory !== 1024
    )
      throw Error('M04_ACTOR_DESCRIPTOR_INVALID');
    state.launchDescriptor = d;
    state.action = 'apify';
    return state;
  }
  if (op === 'register') {
    if (
      result?.registered !== true ||
      result.apify_run_id !== state.startedActorId ||
      result.run_id !== state.runId
    )
      bad();
    if (state.kind === 'vimeo') {
      state.afterCost = 'fallback';
      const c = state.current;
      return collectorGateway(state, 'cost', {
        entries: [
          {
            provider: 'vimeo',
            category: 'scrape',
            quantity: c.calls,
            unit: 'call',
            cost_usd: 0,
            run_id: state.runId,
            competitor_id: c.account.competitor_id,
            platform: 'vimeo',
            meta: {
              actor: 'vimeo-api',
              account_id: c.account.account_id,
              cost_key: 'vimeo:' + state.runId + ':' + c.account.account_id,
            },
          },
        ],
      });
    }
    state.batchIndex += 1;
    return nextInstagramLaunch(state);
  }
  if (op === 'close_registration') {
    if (result?.registration_closed !== true) bad();
    state.action = 'done';
    state.summary = result;
    return state;
  }
  bad();
}

export function nextInstagramLaunch(state) {
  if (state.batchIndex >= state.batches.length)
    return collectorGateway(state, 'close_registration', { run_id: state.runId });
  const batch = state.batches[state.batchIndex];
  state.launchId = collectorRequestId(state.executionId, state.sequence + 1);
  return collectorGateway(state, 'launch', {
    run_id: state.runId,
    launch_id: state.launchId,
    actor_id: batch.actor,
    pass: batch.result_type,
    purpose: state.mode,
    account_ids: batch.account_ids,
    results_limit: batch.resultsLimit ?? state.resultsLimit,
  });
}

export function advanceInstagramNative(state, response) {
  // An unknown POST outcome is never a rejection receipt and never authorizes a
  // second start, registration closure, account release or silent retry.
  const run = response?.body?.data;
  if (
    response?.statusCode !== 201 ||
    !run ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(run.id ?? '') ||
    (run.defaultDatasetId !== undefined &&
      run.defaultDatasetId !== null &&
      !/^[A-Za-z0-9_-]{1,128}$/.test(run.defaultDatasetId))
  )
    throw Error('M04_ACTOR_START_RECONCILIATION_REQUIRED');
  state.actorStarts += 1;
  state.startedActorId = run.id;
  const batch = state.batches[state.batchIndex];
  return collectorGateway(state, 'register', {
    run_id: state.runId,
    launch_id: state.launchId,
    apify_run_id: run.id,
    actor_id: batch.actor,
    pass: batch.result_type,
    purpose: state.mode,
    account_ids: batch.account_ids,
  });
}
