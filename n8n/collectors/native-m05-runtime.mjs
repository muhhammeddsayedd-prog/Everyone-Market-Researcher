// Serializable YouTube transitions for native HTTP nodes. No I/O/imports/URL
// global, secrets or general RPC tunnel. Youtube normalizer declarations are
// composed alongside these functions by build-native-m05.mjs.
export function m05RequestId(execution, sequence) {
  if (
    !/^\d{1,15}$/.test(execution) ||
    Number(execution) >= 2 ** 48 ||
    !Number.isSafeInteger(Number(execution)) ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > 4095
  )
    throw Error('M05_EXECUTION_INVALID');
  return `c05c0000-${sequence.toString(16).padStart(4, '0')}-4000-a000-${Number(execution).toString(16).padStart(12, '0')}`;
}
export function m05PacificDay(now) {
  if (!youtubeDate(now)) throw Error('M05_INPUT_INVALID');
  const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(now)),
    values = Object.fromEntries(
      parts.filter((p) => ['year', 'month', 'day'].includes(p.type)).map((p) => [p.type, p.value]),
    );
  return `${values.year}-${values.month}-${values.day}`;
}
export function m05Gateway(state, operation, args) {
  state.sequence++;
  state.action = 'gateway';
  state.request = {
    version: 1,
    requestId: m05RequestId(state.executionId, state.sequence),
    operation: 'm05.' + operation,
    args,
  };
  return state;
}
export function initializeM05Youtube(input, executionId, now) {
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
  if (
    !youtubeRecord(input) ||
    Object.keys(input).some((k) => !['env', 'mode', 'account_ids', 'max_pages', 'page_size'].includes(k)) ||
    input.env !== 'dev' ||
    !['daily', 'backfill'].includes(input.mode) ||
    !Array.isArray(input.account_ids) ||
    input.account_ids.length < 1 ||
    input.account_ids.length > 10 ||
    input.account_ids.some((v) => !uuid(v)) ||
    new Set(input.account_ids).size !== input.account_ids.length ||
    !Number.isInteger(input.max_pages) ||
    input.max_pages < 1 ||
    input.max_pages > (input.mode === 'daily' ? 2 : 40) ||
    !Number.isInteger(input.page_size) ||
    input.page_size < 1 ||
    input.page_size > 50 ||
    !youtubeDate(now)
  )
    throw Error('M05_INPUT_INVALID');
  const state = {
    executionId,
    now,
    mode: input.mode,
    accountIds: input.account_ids,
    maxPages: input.max_pages,
    pageSize: input.page_size,
    sequence: 0,
    accounts: [],
    accountIndex: 0,
    outcomes: [],
    calls: 0,
    quotaDay: m05PacificDay(now),
    context: null,
  };
  return m05Gateway(state, 'start', {
    workflow: 'WF-13',
    platform: 'youtube',
    mode: state.mode,
    env: 'dev',
    execution_id: executionId,
  });
}
export function m05YoutubeUrl(resource, args) {
  return (
    'https://www.googleapis.com/youtube/v3/' +
    resource +
    '?' +
    Object.entries(args)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&')
  );
}
export function m05YoutubeHttp(state, kind, resource, args) {
  state.pendingHttp = { kind, url: m05YoutubeUrl(resource, args) };
  return m05Gateway(state, 'quota', { quota_day: state.quotaDay, quantity: 1 });
}
export function m05CheckQuotaDay(state, now) {
  if (
    state.request?.operation === 'm05.quota' &&
    state.request.args.quantity === 1 &&
    m05PacificDay(now) !== state.quotaDay
  ) {
    state.pendingHttp = null;
    return m05YoutubeSettle(state, 'partial', 'youtube_quota_day_changed');
  }
  return state;
}
export function m05YoutubeList(state) {
  const c = state.context;
  return m05YoutubeHttp(state, 'list', 'playlistItems', {
    part: 'snippet,contentDetails,status',
    playlistId: c.playlistId,
    maxResults: String(state.pageSize),
    ...(c.token ? { pageToken: c.token } : {}),
    fields:
      'nextPageToken,items(snippet/videoOwnerChannelId,contentDetails(videoId,videoPublishedAt),status/privacyStatus)',
  });
}
export function m05YoutubeReport(state) {
  const c = state.context;
  return m05Gateway(state, 'report', {
    run_id: state.runId,
    account_id: c.account.account_id,
    status: c.status === 'success' ? 'success' : 'failed',
    items_seen: c.items.length,
    items_new: c.inserted,
    error: c.error,
    backfill_done: c.status === 'success' && c.complete && state.mode === 'backfill',
    backfill_cursor: c.token
      ? { channel_id: c.channelId, playlist_id: c.playlistId, page_token: c.token, page_size: state.pageSize }
      : null,
  });
}
export function m05YoutubeIngest(state) {
  const c = state.context;
  if (c.offset >= c.batches.length) return m05YoutubeReport(state);
  c.batch = c.batches[c.offset];
  return m05Gateway(state, 'ingest', {
    run_id: state.runId,
    account_id: c.account.account_id,
    items: c.batch,
  });
}
export function m05YoutubeSettle(state, status, error = null) {
  const c = state.context;
  c.status = status;
  c.error = error;
  if (status === 'failed') c.items = [];
  c.offset = 0;
  c.inserted = 0;
  c.batches = youtubeBatches(c.items);
  if (c.calls)
    return m05Gateway(state, 'cost', {
      entries: [
        {
          provider: 'youtube',
          category: 'scrape',
          quantity: c.calls,
          unit: 'quota_unit',
          cost_usd: 0,
          run_id: state.runId,
          competitor_id: c.account.competitor_id,
          platform: 'youtube',
          meta: {
            actor: 'youtube-api',
            account_id: c.account.account_id,
            cost_key: `youtube:${state.runId}:${c.account.account_id}`,
          },
        },
      ],
    });
  return m05YoutubeIngest(state);
}
export function m05YoutubeResolved(state) {
  const c = state.context,
    cursor = state.mode === 'backfill' ? c.account.backfill_cursor : null;
  if (cursor !== undefined && cursor !== null) {
    if (
      !youtubeRecord(cursor) ||
      Object.keys(cursor).some(
        (k) => !['channel_id', 'playlist_id', 'page_token', 'page_size'].includes(k),
      ) ||
      cursor.channel_id !== c.channelId ||
      cursor.playlist_id !== c.playlistId ||
      cursor.page_size !== state.pageSize ||
      typeof cursor.page_token !== 'string' ||
      !cursor.page_token ||
      cursor.page_token.length > 2048 ||
      /[\u0000-\u0020\u007f]/u.test(cursor.page_token)
    )
      return m05YoutubeSettle(state, 'failed', 'youtube_invalid_cursor');
    c.token = cursor.page_token;
    c.tokens.push(c.token);
  }
  return m05YoutubeList(state);
}
export function m05YoutubeAccount(state) {
  const account = state.accounts[state.accountIndex];
  if (!account) {
    const allFailed = state.outcomes.length && state.outcomes.every((o) => o.status === 'failed'),
      incomplete = state.outcomes.some((o) => o.status !== 'success');
    return m05Gateway(state, 'finish', {
      run_id: state.runId,
      status: allFailed ? 'failed' : incomplete ? 'partial' : 'success',
      error: incomplete ? 'youtube_accounts_incomplete' : null,
    });
  }
  const c = (state.context = {
    account,
    channelId: account.external_id || null,
    playlistId: account.uploads_playlist_id || null,
    pages: 0,
    calls: 0,
    items: [],
    tokens: [],
    ids: [],
    token: null,
    unavailable: [],
    complete: false,
  });
  const floor = youtubeDate((account.backfill_from ?? '2024-01-01') + 'T00:00:00Z'),
    watermark = account.watermark_published_at ?? account.last_item_published_at;
  if (
    !floor ||
    (watermark && !youtubeDate(watermark)) ||
    (watermark && Date.parse(watermark) > Date.parse(state.now))
  )
    return m05YoutubeSettle(state, 'failed', 'youtube_invalid_config');
  c.cutoff =
    state.mode === 'daily' && watermark
      ? new Date(Math.max(Date.parse(floor), Date.parse(watermark) - 86400000)).toISOString()
      : floor;
  c.metricsCutoff =
    state.mode === 'daily'
      ? new Date(Math.max(Date.parse(floor), Date.parse(state.now) - 30 * 86400000)).toISOString()
      : floor;
  const match =
    /^https:\/\/(?:www\.)?youtube\.com\/(?:@([A-Za-z0-9._-]{1,100})|channel\/(UC[A-Za-z0-9_-]{22})|user\/([A-Za-z0-9._-]{1,100})|c\/([A-Za-z0-9._-]{1,100})|([A-Za-z0-9._-]{1,100}))\/?$/.exec(
      account.url ?? '',
    );
  if (
    !match ||
    (c.channelId && !youtubeChannelId(c.channelId)) ||
    (c.playlistId && (typeof c.playlistId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(c.playlistId))) ||
    (match[2] && c.channelId && match[2] !== c.channelId)
  )
    return m05YoutubeSettle(state, 'failed', 'youtube_invalid_account');
  if (c.channelId && c.playlistId) return m05YoutubeResolved(state);
  let resolve;
  if (c.channelId || match[2]) resolve = { id: c.channelId ?? match[2] };
  else if (match[1]) resolve = { forHandle: '@' + match[1] };
  else if (match[3]) resolve = { forUsername: match[3] };
  else return m05YoutubeSettle(state, 'failed', 'youtube_unresolved_legacy_url');
  return m05YoutubeHttp(state, 'resolve', 'channels', {
    part: 'id,contentDetails',
    ...resolve,
    fields: 'items(id,contentDetails/relatedPlaylists/uploads)',
  });
}
export function advanceM05YoutubeGateway(state, response) {
  const b = response?.body;
  if (
    response?.statusCode !== 200 ||
    b?.version !== 1 ||
    b.requestId !== state.request.requestId ||
    b.operation !== state.request.operation ||
    typeof b.replayed !== 'boolean' ||
    !Object.hasOwn(b, 'result')
  )
    throw Error('M05_GATEWAY_RECONCILIATION_REQUIRED');
  const result = b.result,
    op = state.request.operation;
  if (op === 'm05.start') {
    if (typeof result?.run_id !== 'string' || !/^[a-f0-9-]{36}$/.test(result.run_id))
      throw Error('M05_RECEIPT_INVALID');
    state.runId = result.run_id;
    return m05Gateway(state, 'claim', {
      run_id: state.runId,
      platform: 'youtube',
      mode: state.mode,
      limit: state.accountIds.length,
      account_ids: state.accountIds,
    });
  }
  if (op === 'm05.claim') {
    if (
      !Array.isArray(result) ||
      result.length > state.accountIds.length ||
      new Set(result.map((a) => a.account_id)).size !== result.length ||
      result.some(
        (a) =>
          !youtubeRecord(a) ||
          !state.accountIds.includes(a.account_id) ||
          typeof a.competitor_id !== 'string' ||
          !/^[a-f0-9-]{36}$/.test(a.competitor_id),
      )
    )
      throw Error('M05_RECEIPT_INVALID');
    state.accounts = result;
    return m05Gateway(state, 'quota', { quota_day: state.quotaDay, quantity: 0 });
  }
  if (op === 'm05.quota') {
    if (
      !youtubeRecord(result) ||
      result.quota_day !== state.quotaDay ||
      !Number.isSafeInteger(result.used_units) ||
      result.used_units < 0 ||
      result.used_units > 8000 ||
      typeof result.permitted !== 'boolean'
    )
      throw Error('M05_RECEIPT_INVALID');
    if (state.pendingHttp) {
      if (!result.permitted) {
        state.pendingHttp = null;
        return m05YoutubeSettle(state, 'partial', 'youtube_quota_guard');
      }
      state.context.calls++;
      state.calls++;
      state.http = state.pendingHttp;
      state.pendingHttp = null;
      state.action = 'youtube';
      return state;
    }
    return m05YoutubeAccount(state);
  }
  if (op === 'm05.resolve') return m05YoutubeResolved(state);
  if (op === 'm05.cost') return m05YoutubeIngest(state);
  if (op === 'm05.ingest') {
    if (
      !Number.isSafeInteger(result?.inserted) ||
      result.inserted < 0 ||
      !Number.isSafeInteger(result?.duplicates) ||
      result.duplicates < 0 ||
      result.inserted + result.duplicates > state.context.batch.length
    )
      throw Error('M05_RECEIPT_INVALID');
    state.context.inserted += result.inserted;
    state.context.offset++;
    return m05YoutubeIngest(state);
  }
  if (op === 'm05.report') {
    const c = state.context;
    state.outcomes.push({
      account_id: c.account.account_id,
      status: c.status,
      error: c.error,
      complete: c.complete,
      items_new: c.inserted,
      unavailable_ids: c.unavailable,
      cursor: state.request.args.backfill_cursor,
    });
    state.accountIndex++;
    return m05YoutubeAccount(state);
  }
  if (op === 'm05.finish') {
    if (
      !youtubeRecord(result) ||
      result.state !== 'completed' ||
      !youtubeRecord(result.summary) ||
      result.summary.run_id !== state.runId ||
      !['success', 'partial', 'failed'].includes(result.summary.status)
    )
      throw Error('M05_RECEIPT_INVALID');
    state.action = 'done';
    state.result = {
      state: 'completed',
      run_id: state.runId,
      status: result.summary.status,
      quota_units: state.calls,
      quota_day: state.quotaDay,
      accounts: state.outcomes,
    };
    return state;
  }
  throw Error('M05_OPERATION_INVALID');
}
export function advanceM05YoutubeHttp(state, response) {
  const c = state.context,
    kind = state.http.kind,
    body = response?.body;
  if (response?.statusCode !== 200)
    return m05YoutubeSettle(
      state,
      'failed',
      response?.statusCode === 403 && body?.error?.errors?.[0]?.reason === 'quotaExceeded'
        ? 'youtube_quota_exceeded'
        : Number.isInteger(response?.statusCode)
          ? 'youtube_api_' + response.statusCode
          : 'youtube_transport_failed',
    );
  if (!youtubeRecord(body)) return m05YoutubeSettle(state, 'failed', 'youtube_invalid_response');
  if (kind === 'resolve') {
    const r = body.items?.[0],
      uploads = r?.contentDetails?.relatedPlaylists?.uploads;
    if (
      !Array.isArray(body.items) ||
      body.items.length !== 1 ||
      !youtubeChannelId(r?.id) ||
      typeof uploads !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(uploads) ||
      (c.channelId && c.channelId !== r.id)
    )
      return m05YoutubeSettle(state, 'failed', 'youtube_owner_mismatch');
    c.channelId = r.id;
    c.playlistId = uploads;
    return m05Gateway(state, 'resolve', {
      account_id: c.account.account_id,
      external_id: r.id,
      uploads_playlist_id: uploads,
    });
  }
  if (kind === 'list') {
    if (
      !Array.isArray(body.items) ||
      body.items.length > state.pageSize ||
      (body.nextPageToken !== undefined &&
        (typeof body.nextPageToken !== 'string' ||
          !body.nextPageToken ||
          body.nextPageToken.length > 2048 ||
          /[\u0000-\u0020\u007f]/u.test(body.nextPageToken)))
    )
      return m05YoutubeSettle(state, 'failed', 'youtube_invalid_response');
    c.pageIds = [];
    c.nextToken = body.nextPageToken ?? null;
    for (const r of body.items) {
      const id = r?.contentDetails?.videoId;
      if (
        !youtubeVideoId(id) ||
        r.snippet?.videoOwnerChannelId !== c.channelId ||
        c.pageIds.includes(id) ||
        c.ids.includes(id)
      )
        return m05YoutubeSettle(state, 'failed', 'youtube_owner_or_identity_mismatch');
      c.pageIds.push(id);
    }
    if (!c.pageIds.length) {
      if (c.nextToken) return m05YoutubeSettle(state, 'failed', 'youtube_empty_nonterminal_page');
      c.token = null;
      c.complete = true;
      return m05YoutubeSettle(state, 'success');
    }
    return m05YoutubeHttp(state, 'videos', 'videos', {
      part: 'snippet,statistics,contentDetails,status',
      id: c.pageIds.join(','),
      fields:
        'items(id,snippet(channelId,publishedAt,title,description,tags,thumbnails),statistics(viewCount,likeCount,commentCount),contentDetails/duration,status/privacyStatus)',
    });
  }
  if (kind === 'videos') {
    if (
      !Array.isArray(body.items) ||
      body.items.length > c.pageIds.length ||
      body.items.some((v) => !c.pageIds.includes(v?.id)) ||
      new Set(body.items.map((v) => v.id)).size !== body.items.length
    )
      return m05YoutubeSettle(state, 'failed', 'youtube_invalid_response');
    const normalized = normalizeYoutubeApiResult(body.items, {
      account: { ...c.account, external_id: c.channelId },
      cutoff: c.cutoff,
      metricsCutoff: c.metricsCutoff,
    });
    if (normalized.errors.length) return m05YoutubeSettle(state, 'failed', 'youtube_contract_drift');
    c.unavailable.push(
      ...c.pageIds.filter((id) => !body.items.some((v) => v.id === id)),
      ...normalized.skipped.map((v) => v.id),
    );
    c.items.push(...normalized.items);
    c.ids.push(...c.pageIds);
    c.pages++;
    if (c.nextToken && c.tokens.includes(c.nextToken))
      return m05YoutubeSettle(state, 'failed', 'youtube_repeated_page_token');
    c.token = c.nextToken;
    if (c.token) c.tokens.push(c.token);
    if (!c.token) {
      c.complete = c.unavailable.length === 0;
      return m05YoutubeSettle(
        state,
        c.complete ? 'success' : 'partial',
        c.complete ? null : 'youtube_videos_unavailable',
      );
    }
    if (c.pages >= state.maxPages) return m05YoutubeSettle(state, 'partial', 'youtube_page_cap');
    return m05YoutubeList(state);
  }
  throw Error('M05_HTTP_STATE_INVALID');
}
